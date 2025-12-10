import React, { useState, useEffect, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import BranchColumn from './components/BranchColumn';
import DiffModal from './components/DiffModal';
import MergeHistory from './components/MergeHistory';
import GitHubConnection from './components/GitHubConnection';
import { branchApi, githubApi, Branch, Diff, MergeHistory as MergeHistoryType, GitHubConnectionStatus } from './services/api';
import { websocketService } from './services/websocket';
import './App.css';

function App() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [diffModal, setDiffModal] = useState<{ source: string; target: string; diff: Diff | null } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [mergeHistory, setMergeHistory] = useState<MergeHistoryType[]>([]);
  const [githubConnected, setGithubConnected] = useState(false);
  const [useGitHub, setUseGitHub] = useState(false);

  const loadBranches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = useGitHub && githubConnected
        ? await githubApi.getAllBranches()
        : await branchApi.getAllBranches();
      setBranches(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, [useGitHub, githubConnected]);

  const loadMergeHistory = useCallback(async () => {
    try {
      const history = await branchApi.getMergeHistory();
      setMergeHistory(history);
    } catch (err) {
      console.error('Failed to load merge history:', err);
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    websocketService.connect();

    // Listen for GitHub branch updates
    const unsubscribeBranches = websocketService.on('github:branches-updated', (updatedBranches: Branch[]) => {
      if (useGitHub && githubConnected) {
        setBranches(updatedBranches);
      }
    });

    // Listen for GitHub push events
    const unsubscribePush = websocketService.on('github:push', (data) => {
      if (useGitHub && githubConnected) {
        setSuccessMessage(`Branch ${data.branch} was updated on GitHub`);
        loadBranches();
      }
    });

    // Listen for PR creation
    const unsubscribePR = websocketService.on('github:pr-created', (data) => {
      if (data.success) {
        setSuccessMessage(`Pull request #${data.pr.number} created successfully!`);
        window.open(data.pr.url, '_blank');
      }
    });

    return () => {
      unsubscribeBranches();
      unsubscribePush();
      unsubscribePR();
      websocketService.disconnect();
    };
  }, [useGitHub, githubConnected, loadBranches]);

  useEffect(() => {
    loadBranches();
    if (!useGitHub) {
      loadMergeHistory();
    }
    // Refresh branches every 30 seconds (only for local Git)
    if (!useGitHub) {
      const interval = setInterval(loadBranches, 30000);
      return () => clearInterval(interval);
    }
  }, [loadBranches, loadMergeHistory, useGitHub]);

  const handleDrop = async (sourceBranch: string, targetBranch: string) => {
    if (sourceBranch === targetBranch) {
      setError('Cannot merge a branch into itself');
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      // For GitHub, create a pull request instead of direct merge
      if (useGitHub && githubConnected) {
        // Show diff preview
        try {
          const diff = await githubApi.getDiff(sourceBranch, targetBranch);
          setDiffModal({ source: sourceBranch, target: targetBranch, diff });
        } catch (err) {
          console.error('Failed to load diff:', err);
        }

        // Ask for confirmation
        const confirmed = window.confirm(
          `Create a pull request to merge ${sourceBranch} into ${targetBranch}?`
        );

        if (!confirmed) {
          setDiffModal(null);
          return;
        }

        // Create pull request
        const result = await githubApi.createPullRequest(
          sourceBranch,
          targetBranch,
          `Merge ${sourceBranch} into ${targetBranch}`,
          `Automated merge from ${sourceBranch} to ${targetBranch}`
        );

        if (result.success) {
          setSuccessMessage(`Pull request #${result.pr.number} created successfully!`);
          setDiffModal(null);
          // Reload branches
          await loadBranches();
        } else {
          setError('Failed to create pull request');
        }
        return;
      }

      // For local Git, perform direct merge
      // Validate merge first
      const validation = await branchApi.validateMerge(sourceBranch, targetBranch);
      if (!validation.allowed) {
        setError(validation.reason);
        return;
      }

      // Show diff preview before merging
      try {
        const diff = await branchApi.getDiff(sourceBranch, targetBranch);
        setDiffModal({ source: sourceBranch, target: targetBranch, diff });
      } catch (err) {
        // If diff fails, still allow merge
        console.error('Failed to load diff:', err);
      }

      // Ask for confirmation
      const confirmed = window.confirm(
        `Are you sure you want to merge ${sourceBranch} into ${targetBranch}?`
      );

      if (!confirmed) {
        setDiffModal(null);
        return;
      }

      // Perform merge
      const result = await branchApi.performMerge(sourceBranch, targetBranch);
      
      if (result.success) {
        setSuccessMessage(result.message || `Successfully merged ${sourceBranch} into ${targetBranch}`);
        setDiffModal(null);
        // Reload branches and history
        await loadBranches();
        await loadMergeHistory();
      } else {
        setError(result.error || 'Merge failed');
        if (result.requiresResolution) {
          setError('Merge conflict detected. Please resolve conflicts manually.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to perform merge');
    }
  };

  const handleGitHubConnected = (status: GitHubConnectionStatus) => {
    setGithubConnected(status.connected);
    if (status.connected) {
      setUseGitHub(true);
      loadBranches();
    }
  };

  const handleGitHubDisconnected = () => {
    setGithubConnected(false);
    setUseGitHub(false);
    loadBranches();
  };

  // Group branches by type
  const groupedBranches = {
    prod: branches.filter(b => b.type === 'prod'),
    uat: branches.filter(b => b.type === 'uat'),
    feature: branches.filter(b => b.type === 'feature'),
    hotfix: branches.filter(b => b.type === 'hotfix'),
    other: branches.filter(b => b.type === 'other'),
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="App">
        <header className="app-header">
          <div className="header-content">
            <h1>🌿 Branching Tool</h1>
            <p>Drag and drop branches to merge them</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={loadBranches} disabled={loading}>
              🔄 Refresh
            </button>
            {!useGitHub && (
              <button className="btn-secondary" onClick={() => setShowHistory(true)}>
                📜 History
              </button>
            )}
            {githubConnected && (
              <button 
                className="btn-secondary" 
                onClick={() => setUseGitHub(!useGitHub)}
                title={useGitHub ? 'Switch to local Git' : 'Switch to GitHub'}
              >
                {useGitHub ? '📁 Local' : '🐙 GitHub'}
              </button>
            )}
          </div>
        </header>

        <GitHubConnection 
          onConnected={handleGitHubConnected}
          onDisconnected={handleGitHubDisconnected}
        />

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <span>✓</span>
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)}>×</button>
          </div>
        )}

        {useGitHub && githubConnected && (
          <div className="alert alert-info" style={{ background: '#e3f2fd', color: '#1976d2' }}>
            <span>🐙</span>
            <span>Connected to GitHub - Real-time updates enabled</span>
          </div>
        )}

        {loading && branches.length === 0 ? (
          <div className="loading">Loading branches...</div>
        ) : (
          <div className="branches-container">
            <BranchColumn
              title="Production"
              type="prod"
              branches={groupedBranches.prod}
              onDrop={handleDrop}
            />
            <BranchColumn
              title="UAT / Staging"
              type="uat"
              branches={groupedBranches.uat}
              onDrop={handleDrop}
            />
            <BranchColumn
              title="Feature Branches"
              type="feature"
              branches={groupedBranches.feature}
              onDrop={handleDrop}
            />
            <BranchColumn
              title="Hotfix Branches"
              type="hotfix"
              branches={groupedBranches.hotfix}
              onDrop={handleDrop}
            />
            {groupedBranches.other.length > 0 && (
              <BranchColumn
                title="Other Branches"
                type="other"
                branches={groupedBranches.other}
                onDrop={handleDrop}
              />
            )}
          </div>
        )}

        {diffModal && (
          <DiffModal
            diff={diffModal.diff}
            sourceBranch={diffModal.source}
            targetBranch={diffModal.target}
            onClose={() => setDiffModal(null)}
          />
        )}

        {showHistory && (
          <MergeHistory
            history={mergeHistory}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </DndProvider>
  );
}

export default App;