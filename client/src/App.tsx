import React, { useState, useEffect, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import BranchColumn from './components/BranchColumn';
import DiffModal from './components/DiffModal';
import MergeHistory from './components/MergeHistory';
import GitHubConnection from './components/GitHubConnection';
import BranchNameModal from './components/BranchNameModal';
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
  const [branchCreationModal, setBranchCreationModal] = useState<{
    sourceBranch: string;
    targetType: 'prod' | 'uat' | 'feature' | 'hotfix' | 'other';
  } | null>(null);
  const [uncommittedChangesModal, setUncommittedChangesModal] = useState<{
    targetBranch: string;
    changes: any;
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
        try {
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
        } catch (prError: any) {
          // Extract error message from API response
          const errorMessage = prError.response?.data?.error || prError.message || 'Failed to create pull request';
          setError(errorMessage);
          setDiffModal(null);
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

  // Get prefix for branch type
  const getBranchPrefix = (type: 'prod' | 'uat' | 'feature' | 'hotfix' | 'other'): string => {
    switch (type) {
      case 'prod':
        return 'prod/';
      case 'uat':
        return 'uat/';
      case 'feature':
        return 'feature/';
      case 'hotfix':
        return 'hotfix/';
      default:
        return '';
    }
  };

  // Handle branch creation request (show modal)
  const handleCreateBranch = (sourceBranch: string, targetType: 'prod' | 'uat' | 'feature' | 'hotfix' | 'other') => {
    setBranchCreationModal({ sourceBranch, targetType });
  };

  // Handle branch creation confirmation
  const handleConfirmBranchCreation = async (branchName: string) => {
    if (!branchCreationModal) return;

    try {
      setError(null);
      setSuccessMessage(null);

      const result = useGitHub && githubConnected
        ? await githubApi.createBranch(branchName, branchCreationModal.sourceBranch)
        : await branchApi.createBranch(branchName, branchCreationModal.sourceBranch);

      if (result.success) {
        setSuccessMessage(result.message || `Branch ${branchName} created successfully`);
        setBranchCreationModal(null);
        await loadBranches();
      } else {
        setError('Failed to create branch');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create branch');
    }
  };

  // Handle branch checkout and pull
  const handleCheckoutAndPull = async (branchName: string) => {
    try {
      setError(null);
      setSuccessMessage(null);

      const result = useGitHub && githubConnected
        ? await githubApi.checkoutAndPull(branchName)
        : await branchApi.checkoutAndPull(branchName);

      if (result.success) {
        setSuccessMessage(result.message || `Checked out to ${branchName} and pulled latest changes`);
        await loadBranches();
      } else {
        setError('Failed to checkout branch');
      }
    } catch (err: any) {
      // Check if error is due to uncommitted changes
      const errorData = err.response?.data || err;
      const errorMessage = errorData?.error || err.message || 'Failed to checkout branch';
      
      // Check for uncommitted changes in various possible error formats
      if (
        (errorData?.code === 'UNCOMMITTED_CHANGES' || 
         errorMessage.includes('uncommitted changes') ||
         errorMessage.includes('Please commit or stash')) &&
        errorData?.uncommittedChanges
      ) {
        // Show modal with uncommitted changes
        setUncommittedChangesModal({
          targetBranch: branchName,
          changes: errorData.uncommittedChanges
        });
      } else if (errorMessage.includes('uncommitted changes') || errorMessage.includes('Please commit or stash')) {
        // If error message mentions uncommitted changes but we don't have the details, fetch them
        try {
          const changes = await branchApi.getUncommittedChanges();
          setUncommittedChangesModal({
            targetBranch: branchName,
            changes: changes
          });
        } catch (fetchErr) {
          // If we can't fetch changes, show error
          setError(errorMessage);
        }
      } else {
        // Regular error
        setError(errorMessage);
      }
    }
  };

  // Retry checkout after handling uncommitted changes
  const retryCheckout = async (branchName: string) => {
    setUncommittedChangesModal(null);
    await handleCheckoutAndPull(branchName);
  };

  // Handle commit changes
  const handleCommit = async (message: string) => {
    try {
      setError(null);
      const result = await branchApi.commitChanges(message);
      if (result.success) {
        setSuccessMessage('Changes committed successfully');
        if (uncommittedChangesModal) {
          await retryCheckout(uncommittedChangesModal.targetBranch);
        }
      } else {
        throw new Error('Failed to commit changes');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to commit changes';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  // Handle stash changes
  const handleStash = async (message: string) => {
    try {
      setError(null);
      const result = await branchApi.stashChanges(message);
      if (result.success) {
        setSuccessMessage('Changes stashed successfully');
        if (uncommittedChangesModal) {
          await retryCheckout(uncommittedChangesModal.targetBranch);
        }
      } else {
        throw new Error('Failed to stash changes');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to stash changes';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  // Handle discard changes
  const handleDiscard = async () => {
    try {
      setError(null);
      const result = await branchApi.discardChanges();
      if (result.success) {
        setSuccessMessage('Changes discarded successfully');
        if (uncommittedChangesModal) {
          await retryCheckout(uncommittedChangesModal.targetBranch);
        }
      } else {
        throw new Error('Failed to discard changes');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to discard changes';
      setError(errorMsg);
      throw new Error(errorMsg);
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
              onCreateBranch={handleCreateBranch}
              onCheckout={handleCheckoutAndPull}
            />
            <BranchColumn
              title="UAT / Staging"
              type="uat"
              branches={groupedBranches.uat}
              onDrop={handleDrop}
              onCreateBranch={handleCreateBranch}
              onCheckout={handleCheckoutAndPull}
            />
            <BranchColumn
              title="Feature Branches"
              type="feature"
              branches={groupedBranches.feature}
              onDrop={handleDrop}
              onCreateBranch={handleCreateBranch}
              onCheckout={handleCheckoutAndPull}
            />
            <BranchColumn
              title="Hotfix Branches"
              type="hotfix"
              branches={groupedBranches.hotfix}
              onDrop={handleDrop}
              onCreateBranch={handleCreateBranch}
              onCheckout={handleCheckoutAndPull}
            />
            {groupedBranches.other.length > 0 && (
              <BranchColumn
                title="Other Branches"
                type="other"
                branches={groupedBranches.other}
                onDrop={handleDrop}
                onCreateBranch={handleCreateBranch}
                onCheckout={handleCheckoutAndPull}
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

        {branchCreationModal && (
          <BranchNameModal
            prefix={getBranchPrefix(branchCreationModal.targetType)}
            sourceBranch={branchCreationModal.sourceBranch}
            targetType={branchCreationModal.targetType}
            onConfirm={handleConfirmBranchCreation}
            onCancel={() => setBranchCreationModal(null)}
          />
        )}

        {uncommittedChangesModal && (
          <UncommittedChangesModal
            targetBranch={uncommittedChangesModal.targetBranch}
            changes={uncommittedChangesModal.changes}
            onCommit={handleCommit}
            onStash={handleStash}
            onDiscard={handleDiscard}
            onCancel={() => setUncommittedChangesModal(null)}
          />
        )}
      </div>
    </DndProvider>
  );
}

export default App;