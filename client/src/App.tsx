import React, { useState, useEffect, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import BranchColumn from './components/BranchColumn';
import DiffModal from './components/DiffModal';
import MergeHistory from './components/MergeHistory';
import GitHubConnection from './components/GitHubConnection';
import UncommittedChangesModal from './components/UncommittedChangesModal';
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
  const [uncommittedChangesModal, setUncommittedChangesModal] = useState<{
    targetBranch: string;
    currentBranch: string;
    uncommittedChanges: any;
  } | null>(null);

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
    const unsubscribePush = websocketService.on('github:push', (data: { branch: string }) => {
      if (useGitHub && githubConnected) {
        setSuccessMessage(`Branch ${data.branch} was updated on GitHub`);
        loadBranches();
      }
    });

    // Listen for PR creation
    const unsubscribePR = websocketService.on('github:pr-created', (data: { success: boolean; pr?: { number: number; title: string; state: string; url: string; diffUrl: string } }) => {
      if (data.success && data.pr) {
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

  const handleDrop = async (sourceBranch: string, targetBranch: string | null, columnType?: string) => {
    if (sourceBranch === targetBranch) {
      setError('Cannot create a branch from itself');
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      // Determine prefix branch
      let prefixBranch: string | null = null;

      if (targetBranch) {
        // Dropped on a specific branch - use that branch as prefix source
        prefixBranch = targetBranch;
      } else if (columnType) {
        // Dropped on a column (empty or on column itself) - find a representative branch from that column
        const groupedBranches = {
          prod: branches.filter(b => b.type === 'prod'),
          uat: branches.filter(b => b.type === 'uat'),
          feature: branches.filter(b => b.type === 'feature'),
          hotfix: branches.filter(b => b.type === 'hotfix'),
          other: branches.filter(b => b.type === 'other'),
        };
        const columnBranches = groupedBranches[columnType as keyof typeof groupedBranches];
        if (columnBranches && columnBranches.length > 0) {
          // Use the first branch in the column as prefix source
          prefixBranch = columnBranches[0].name;
        } else {
          // No branches in column - use column type as prefix
          // We'll need to create a temporary branch name or use a default
          setError(`Cannot create branch: No branches in ${columnType} section to use as prefix`);
          return;
        }
      } else {
        setError('Invalid drop target');
        return;
      }

      if (!prefixBranch) {
        setError('Could not determine prefix branch');
        return;
      }

      // Ask for confirmation
      const newBranchName = prefixBranch.includes('/') 
        ? `${prefixBranch.split('/')[0]}/${sourceBranch.includes('/') ? sourceBranch.split('/').slice(1).join('/') : sourceBranch}`
        : `${prefixBranch}/${sourceBranch.includes('/') ? sourceBranch.split('/').slice(1).join('/') : sourceBranch}`;

      const confirmed = window.confirm(
        `Create a new branch "${newBranchName}" from "${sourceBranch}" with prefix from "${prefixBranch}"?`
      );

      if (!confirmed) {
        return;
      }

      // Create branch with prefix
      try {
        const result = useGitHub && githubConnected
          ? await githubApi.createBranchWithPrefix(sourceBranch, prefixBranch)
          : await branchApi.createBranchWithPrefix(sourceBranch, prefixBranch);
        
        if (result.success) {
          setSuccessMessage(result.message || `Successfully created branch ${result.branchName}`);
          // Reload branches
          await loadBranches();
        } else {
          setError(result.error || 'Failed to create branch');
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to create branch';
        setError(errorMessage);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create branch');
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

  const handleBranchDoubleClick = async (targetBranchName: string) => {
    try {
      setError(null);
      setSuccessMessage(null);

      // For GitHub mode, we can't check uncommitted changes the same way
      if (useGitHub && githubConnected) {
        // Try to switch directly - GitHub service will handle errors
        await switchToBranch(targetBranchName);
        return;
      }

      // Get current branch and check for uncommitted changes
      const status = await branchApi.getRepositoryStatus();
      const currentBranch = status.currentBranch;

      // If already on the target branch, do nothing
      if (currentBranch === targetBranchName) {
        return;
      }

      // Check if there are uncommitted changes
      if (status.hasUncommittedChanges) {
        // Get detailed uncommitted changes
        const changes = await branchApi.getUncommittedChanges();
        
        // Show modal to handle uncommitted changes
        setUncommittedChangesModal({
          targetBranch: targetBranchName,
          currentBranch: currentBranch,
          uncommittedChanges: changes,
        });
        return;
      }

      // No uncommitted changes, switch directly
      await switchToBranch(targetBranchName);
    } catch (err: any) {
      setError(err.message || 'Failed to switch branch');
    }
  };

  const switchToBranch = async (branchName: string) => {
    try {
      setError(null);
      setSuccessMessage(null);

      // For GitHub, use GitHub API
      if (useGitHub && githubConnected) {
        await githubApi.checkoutAndPull(branchName);
      } else {
        await branchApi.checkoutAndPull(branchName);
      }

      setSuccessMessage(`Switched to branch: ${branchName}`);
      setUncommittedChangesModal(null);
      await loadBranches();
    } catch (err: any) {
      // Check if it's an uncommitted changes error (only for local Git)
      if (!useGitHub && (err.response?.data?.code === 'UNCOMMITTED_CHANGES' || 
          err.message?.includes('uncommitted changes'))) {
        try {
          const changes = err.response?.data?.uncommittedChanges || 
                         await branchApi.getUncommittedChanges();
          const status = await branchApi.getRepositoryStatus();
          
          setUncommittedChangesModal({
            targetBranch: branchName,
            currentBranch: status.currentBranch,
            uncommittedChanges: changes,
          });
        } catch (fetchErr: any) {
          // If we can't fetch changes, just show the error
          setError(err.message || 'Failed to switch branch');
          setUncommittedChangesModal(null);
        }
      } else {
        setError(err.message || 'Failed to switch branch');
        setUncommittedChangesModal(null);
      }
    }
  };

  const handleCommitAndPush = async (message: string) => {
    if (!uncommittedChangesModal) return;

    try {
      const status = await branchApi.getRepositoryStatus();
      await branchApi.commitAndPush(message, status.currentBranch);
      
      // After commit and push, switch to target branch
      await switchToBranch(uncommittedChangesModal.targetBranch);
    } catch (err: any) {
      throw err;
    }
  };

  const handleStash = async (message?: string) => {
    if (!uncommittedChangesModal) return;

    try {
      await branchApi.stashChanges(message);
      
      // After stashing, switch to target branch
      await switchToBranch(uncommittedChangesModal.targetBranch);
    } catch (err: any) {
      throw err;
    }
  };

  const handleRevert = async () => {
    if (!uncommittedChangesModal) return;

    try {
      await branchApi.discardChanges();
      
      // After reverting, switch to target branch
      await switchToBranch(uncommittedChangesModal.targetBranch);
    } catch (err: any) {
      throw err;
    }
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
              onBranchDoubleClick={handleBranchDoubleClick}
            />
            <BranchColumn
              title="UAT / Staging"
              type="uat"
              branches={groupedBranches.uat}
              onDrop={handleDrop}
              onBranchDoubleClick={handleBranchDoubleClick}
            />
            <BranchColumn
              title="Feature Branches"
              type="feature"
              branches={groupedBranches.feature}
              onDrop={handleDrop}
              onBranchDoubleClick={handleBranchDoubleClick}
            />
            <BranchColumn
              title="Hotfix Branches"
              type="hotfix"
              branches={groupedBranches.hotfix}
              onDrop={handleDrop}
              onBranchDoubleClick={handleBranchDoubleClick}
            />
            {groupedBranches.other.length > 0 && (
              <BranchColumn
                title="Other Branches"
                type="other"
                branches={groupedBranches.other}
                onDrop={handleDrop}
                onBranchDoubleClick={handleBranchDoubleClick}
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

        {uncommittedChangesModal && (
          <UncommittedChangesModal
            targetBranch={uncommittedChangesModal.targetBranch}
            currentBranch={uncommittedChangesModal.currentBranch}
            uncommittedChanges={uncommittedChangesModal.uncommittedChanges}
            onCommitAndPush={handleCommitAndPush}
            onStash={handleStash}
            onRevert={handleRevert}
            onCancel={() => setUncommittedChangesModal(null)}
          />
        )}
      </div>
    </DndProvider>
  );
}

export default App;