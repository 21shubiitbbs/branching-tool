import React, { useState, useEffect, useRef } from 'react';
import './BranchNameModal.css';

interface BranchNameModalProps {
  prefix: string;
  sourceBranch: string;
  targetType: 'prod' | 'uat' | 'feature' | 'hotfix' | 'other';
  onConfirm: (branchName: string) => void;
  onCancel: () => void;
}

const BranchNameModal: React.FC<BranchNameModalProps> = ({
  prefix,
  sourceBranch,
  targetType,
  onConfirm,
  onCancel,
}) => {
  const [branchName, setBranchName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'prod':
        return '#ef4444';
      case 'uat':
        return '#f59e0b';
      case 'feature':
        return '#3b82f6';
      case 'hotfix':
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'prod':
        return '🚀';
      case 'uat':
        return '🧪';
      case 'feature':
        return '✨';
      case 'hotfix':
        return '🔧';
      default:
        return '📦';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!branchName.trim()) {
      setError('Branch name cannot be empty');
      return;
    }

    // Validate branch name (Git branch name rules)
    const branchNameRegex = /^[a-zA-Z0-9._/-]+$/;
    if (!branchNameRegex.test(branchName.trim())) {
      setError('Branch name contains invalid characters. Use only letters, numbers, dots, underscores, hyphens, and slashes.');
      return;
    }

    const fullBranchName = `${prefix}${branchName.trim()}`;
    onConfirm(fullBranchName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const fullPreview = `${prefix}${branchName.trim()}`;

  return (
    <div className="branch-name-modal-overlay" onClick={onCancel}>
      <div className="branch-name-modal-content" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="branch-name-modal-header" style={{ borderTopColor: getTypeColor(targetType) }}>
          <div className="header-icon">{getTypeIcon(targetType)}</div>
          <div className="header-text">
            <h2>Create New Branch</h2>
            <p>Creating branch from <strong>{sourceBranch}</strong></p>
          </div>
          <button className="close-button" onClick={onCancel} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="branch-name-form">
          <div className="form-section">
            <label className="form-label">Branch Prefix (Fixed)</label>
            <div className="prefix-display" style={{ borderColor: getTypeColor(targetType) }}>
              <span className="prefix-text">{prefix}</span>
              <span className="prefix-badge">Fixed</span>
            </div>
          </div>

          <div className="form-section">
            <label htmlFor="branch-name-input" className="form-label">
              Branch Name
            </label>
            <input
              id="branch-name-input"
              ref={inputRef}
              type="text"
              value={branchName}
              onChange={(e) => {
                setBranchName(e.target.value);
                setError(null);
              }}
              placeholder="Enter branch name..."
              className={`branch-name-input ${error ? 'input-error' : ''}`}
              autoComplete="off"
            />
            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="form-section">
            <label className="form-label">Full Branch Name Preview</label>
            <div className="preview-display">
              <code className="preview-text">{fullPreview || <span className="preview-placeholder">prefix + name</span>}</code>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-create" 
              style={{ backgroundColor: getTypeColor(targetType) }}
              disabled={!branchName.trim()}
            >
              Create Branch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BranchNameModal;
