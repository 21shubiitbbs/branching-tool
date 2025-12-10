import React, { useState } from 'react';
import './UncommittedChangesModal.css';

interface UncommittedChanges {
  hasChanges: boolean;
  modified: string[];
  created: string[];
  deleted: string[];
  not_added: string[];
  conflicted: string[];
  staged: string[];
  files: string[];
}

interface UncommittedChangesModalProps {
  targetBranch: string;
  changes: UncommittedChanges;
  onCommit: (message: string) => Promise<void>;
  onStash: (message: string) => Promise<void>;
  onDiscard: () => Promise<void>;
  onCancel: () => void;
}

const UncommittedChangesModal: React.FC<UncommittedChangesModalProps> = ({
  targetBranch,
  changes,
  onCommit,
  onStash,
  onDiscard,
  onCancel,
}) => {
  const [action, setAction] = useState<'commit' | 'stash' | 'discard' | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommit = async () => {
    if (!message.trim()) {
      setError('Commit message is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onCommit(message);
    } catch (err: any) {
      setError(err.message || 'Failed to commit changes');
      setLoading(false);
    }
  };

  const handleStash = async () => {
    setLoading(true);
    setError(null);
    try {
      await onStash(message || 'Stashed changes before checkout');
    } catch (err: any) {
      setError(err.message || 'Failed to stash changes');
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    const confirmed = window.confirm(
      '⚠️ Warning: This will permanently discard all uncommitted changes. This action cannot be undone!\n\nAre you sure you want to continue?'
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      await onDiscard();
    } catch (err: any) {
      setError(err.message || 'Failed to discard changes');
      setLoading(false);
    }
  };

  const getFileTypeIcon = (file: string) => {
    if (changes.deleted.includes(file)) return '🗑️';
    if (changes.created.includes(file)) return '✨';
    if (changes.modified.includes(file)) return '📝';
    return '📄';
  };

  const getFileTypeLabel = (file: string) => {
    if (changes.deleted.includes(file)) return 'Deleted';
    if (changes.created.includes(file)) return 'New';
    if (changes.modified.includes(file)) return 'Modified';
    return 'Untracked';
  };

  return (
    <div className="uncommitted-changes-modal-overlay" onClick={onCancel}>
      <div className="uncommitted-changes-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-icon">⚠️</div>
          <div className="header-text">
            <h2>Uncommitted Changes Detected</h2>
            <p>You have uncommitted changes that need to be handled before switching to <strong>{targetBranch}</strong></p>
          </div>
          <button className="close-button" onClick={onCancel} aria-label="Close">×</button>
        </div>

        <div className="changes-summary">
          <div className="summary-item">
            <span className="summary-label">Modified</span>
            <span className="summary-value">{changes.modified.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">New Files</span>
            <span className="summary-value">{changes.created.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Deleted</span>
            <span className="summary-value">{changes.deleted.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Untracked</span>
            <span className="summary-value">{changes.not_added.length}</span>
          </div>
        </div>

        <div className="changes-files">
          <h3>Changed Files ({changes.files.length})</h3>
          <div className="files-list">
            {changes.files.slice(0, 10).map((file, index) => (
              <div key={index} className="file-item">
                <span className="file-icon">{getFileTypeIcon(file)}</span>
                <span className="file-name" title={file}>{file}</span>
                <span className="file-type">{getFileTypeLabel(file)}</span>
              </div>
            ))}
            {changes.files.length > 10 && (
              <div className="more-files">+ {changes.files.length - 10} more files</div>
            )}
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="action-section">
          <h3>Choose an action:</h3>
          
          <div className="action-buttons">
            <button
              className={`action-btn commit-btn ${action === 'commit' ? 'active' : ''}`}
              onClick={() => setAction('commit')}
              disabled={loading}
            >
              <span className="btn-icon">💾</span>
              <span className="btn-text">Commit Changes</span>
            </button>
            
            <button
              className={`action-btn stash-btn ${action === 'stash' ? 'active' : ''}`}
              onClick={() => setAction('stash')}
              disabled={loading}
            >
              <span className="btn-icon">📦</span>
              <span className="btn-text">Stash Changes</span>
            </button>
            
            <button
              className={`action-btn discard-btn ${action === 'discard' ? 'active' : ''}`}
              onClick={() => setAction('discard')}
              disabled={loading}
            >
              <span className="btn-icon">🗑️</span>
              <span className="btn-text">Discard Changes</span>
            </button>
          </div>

          {action && (
            <div className="action-form">
              {(action === 'commit' || action === 'stash') && (
                <div className="message-input-section">
                  <label htmlFor="message-input">
                    {action === 'commit' ? 'Commit Message' : 'Stash Message (optional)'}
                  </label>
                  <textarea
                    id="message-input"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={action === 'commit' ? 'Enter commit message...' : 'Enter stash message (optional)...'}
                    rows={3}
                    disabled={loading}
                  />
                </div>
              )}

              {action === 'discard' && (
                <div className="discard-warning">
                  <p>⚠️ This will permanently delete all uncommitted changes. This action cannot be undone!</p>
                </div>
              )}

              <div className="form-actions">
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setAction(null);
                    setMessage('');
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className={`btn-confirm ${action === 'commit' ? 'commit' : action === 'stash' ? 'stash' : 'discard'}`}
                  onClick={() => {
                    if (action === 'commit') handleCommit();
                    else if (action === 'stash') handleStash();
                    else if (action === 'discard') handleDiscard();
                  }}
                  disabled={loading || (action === 'commit' && !message.trim())}
                >
                  {loading ? 'Processing...' : action === 'commit' ? 'Commit' : action === 'stash' ? 'Stash' : 'Discard All'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UncommittedChangesModal;
