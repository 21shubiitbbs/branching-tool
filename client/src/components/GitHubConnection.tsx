import React, { useState, useEffect } from 'react';
import { githubApi, GitHubConnectionStatus } from '../services/api';
import { websocketService } from '../services/websocket';
import './GitHubConnection.css';

interface GitHubConnectionProps {
  onConnected?: (status: GitHubConnectionStatus) => void;
  onDisconnected?: () => void;
}

const GitHubConnection: React.FC<GitHubConnectionProps> = ({ onConnected, onDisconnected }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<GitHubConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');

  useEffect(() => {
    // Check initial status
    checkStatus();

    // Listen for WebSocket events
    const unsubscribeConnected = websocketService.on('github:connected', (data) => {
      setStatus({ connected: true, repo: data.repo });
      setError(null);
      setIsOpen(false);
      onConnected?.({ connected: true, repo: data.repo });
    });

    const unsubscribeDisconnected = websocketService.on('github:disconnected', () => {
      setStatus({ connected: false });
      onDisconnected?.();
    });

    const unsubscribeStatus = websocketService.on('github:status', (data) => {
      setStatus(data);
    });

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeStatus();
    };
  }, [onConnected, onDisconnected]);

  const checkStatus = async () => {
    try {
      const currentStatus = await githubApi.getStatus();
      setStatus(currentStatus);
    } catch (err: any) {
      console.error('Error checking GitHub status:', err);
    }
  };

  const handleConnect = async () => {
    if (!token || !owner || !repo) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await githubApi.connect(token, owner, repo);
      // Status will be updated via WebSocket event
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to connect to GitHub');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);

    try {
      await githubApi.disconnect();
      setStatus({ connected: false });
      onDisconnected?.();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to disconnect from GitHub');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="github-connection">
      <div className="github-status">
        {status.connected ? (
          <div className="github-connected">
            <span className="status-indicator connected">●</span>
            <span className="status-text">
              Connected to <strong>{status.repo?.fullName || 'GitHub'}</strong>
            </span>
            <button 
              className="btn-disconnect" 
              onClick={handleDisconnect}
              disabled={loading}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="github-disconnected">
            <span className="status-indicator disconnected">●</span>
            <span className="status-text">Not connected to GitHub</span>
            <button 
              className="btn-connect" 
              onClick={() => setIsOpen(true)}
            >
              Connect to GitHub
            </button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="github-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="github-modal" onClick={(e) => e.stopPropagation()}>
            <div className="github-modal-header">
              <h2>Connect to GitHub</h2>
              <button className="modal-close" onClick={() => setIsOpen(false)}>×</button>
            </div>

            <div className="github-modal-body">
              <p className="github-help-text">
                Enter your GitHub Personal Access Token and repository details to enable real-time updates.
                <br />
                <a 
                  href="https://github.com/settings/tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Create a token here
                </a>
              </p>

              {error && (
                <div className="github-error">
                  {error}
                </div>
              )}

              <div className="github-form">
                <div className="form-group">
                  <label htmlFor="github-token">GitHub Personal Access Token</label>
                  <input
                    id="github-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="github-owner">Repository Owner</label>
                  <input
                    id="github-owner"
                    type="text"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="username or organization"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="github-repo">Repository Name</label>
                  <input
                    id="github-repo"
                    type="text"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    placeholder="repository-name"
                    disabled={loading}
                  />
                </div>

                <div className="form-actions">
                  <button 
                    className="btn-cancel" 
                    onClick={() => setIsOpen(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={handleConnect}
                    disabled={loading}
                  >
                    {loading ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubConnection;
