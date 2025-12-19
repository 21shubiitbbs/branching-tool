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
  currentBranch: string;
  uncommittedChanges: UncommittedChanges;
  onCommitAndPush: (message: string) => Promise<void>;
  onStash: (message?: string) => Promise<void>;
  onRevert: () => Promise<void>;
  onCancel: () => void;
}

const UncommittedChangesModal: React.FC<UncommittedChangesModalProps> = ({
  targetBranch,
  currentBranch,
  uncommittedChanges,
  onCommitAndPush,
  onStash,
  onRevert,
  onCancel,
}) => {
  const [action, setAction] = useState<'commit' | 'stash' | 'revert' | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [stashMessage, setStashMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommitAndPush = async () => {
    if (!commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onCommitAndPush(commitMessage);
    } catch (err: any) {
      setError(err.message || 'Failed to commit and push changes');
      setLoading(false);
    }
  };

  const handleStash = async () => {
    try {
      setLoading(true);
      setError(null);
      await onStash(stashMessage || undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to stash changes');
      setLoading(false);
    }
  };

  const handleRevert = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to discard all uncommitted changes? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);
      await onRevert();
    } catch (err: any) {
      setError(err.message || 'Failed to revert changes');
      setLoading(false);
    }
  };

  const renderFileList = (files: string[], title: string) => {
    if (files.length === 0) return null;
    return (
      <div className="file-group">
        <h4>{title} ({files.length})</h4>
        <ul>
          {files.map((file, index) => (
            <li key={index} className="file-item">{file}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content uncommitted-changes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Uncommitted Changes Detected</h2>
          <button className="close-button" onClick={onCancel} disabled={loading}>×</button>
        </div>

        <div className="modal-body">
          <div className="warning-message">
            <span className="warning-icon">⚠️</span>
            <p>
              You have uncommitted changes in <strong>{currentBranch}</strong>. 
              Please choose how to handle them before switching to <strong>{targetBranch}</strong>.
            </p>
          </div>

          <div className="changes-summary">
            <h3>Changed Files:</h3>
            {renderFileList(uncommittedChanges.modified, 'Modified')}
            {renderFileList(uncommittedChanges.created, 'Created')}
            {renderFileList(uncommittedChanges.deleted, 'Deleted')}
            {renderFileList(uncommittedChanges.not_added, 'Untracked')}
            {renderFileList(uncommittedChanges.conflicted, 'Conflicted')}
          </div>

          {error && (
            <div className="error-message">
              <span>❌</span>
              <span>{error}</span>
            </div>
          )}

          <div className="action-buttons">
            <button
              className={`action-btn commit-btn ${action === 'commit' ? 'active' : ''}`}
              onClick={() => setAction('commit')}
              disabled={loading}
            >
              💾 Commit & Push
            </button>
            <button
              className={`action-btn stash-btn ${action === 'stash' ? 'active' : ''}`}
              onClick={() => setAction('stash')}
              disabled={loading}
            >
              📦 Stash
            </button>
            <button
              className={`action-btn revert-btn ${action === 'revert' ? 'active' : ''}`}
              onClick={() => setAction('revert')}
              disabled={loading}
            >
              🔄 Revert
            </button>
          </div>

          {action === 'commit' && (
            <div className="action-form">
              <label htmlFor="commit-message">Commit Message:</label>
              <textarea
                id="commit-message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Enter commit message..."
                rows={3}
                disabled={loading}
              />
              <div className="form-actions">
                <button
                  className="btn-primary"
                  onClick={handleCommitAndPush}
                  disabled={loading || !commitMessage.trim()}
                >
                  {loading ? 'Processing...' : 'Commit & Push'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setAction(null);
                    setCommitMessage('');
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {action === 'stash' && (
            <div className="action-form">
              <label htmlFor="stash-message">Stash Message (optional):</label>
              <input
                id="stash-message"
                type="text"
                value={stashMessage}
                onChange={(e) => setStashMessage(e.target.value)}
                placeholder="Enter stash message..."
                disabled={loading}
              />
              <div className="form-actions">
                <button
                  className="btn-primary"
                  onClick={handleStash}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Stash Changes'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setAction(null);
                    setStashMessage('');
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {action === 'revert' && (
            <div className="action-form">
              <div className="revert-warning">
                <p>⚠️ This will permanently discard all uncommitted changes. This action cannot be undone.</p>
              </div>
              <div className="form-actions">
                <button
                  className="btn-danger"
                  onClick={handleRevert}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Confirm Revert'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setAction(null);
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Cancel
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
