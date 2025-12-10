import React from 'react';
import './MergeConfirmationModal.css';

interface MergeConfirmationModalProps {
  sourceBranch: string;
  targetBranch: string;
  isGitHub?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const MergeConfirmationModal: React.FC<MergeConfirmationModalProps> = ({
  sourceBranch,
  targetBranch,
  isGitHub = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="merge-confirm-overlay" onClick={onCancel}>
      <div className="merge-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="merge-confirm-header">
          <div className="merge-confirm-icon">
            {isGitHub ? '🔀' : '⚡'}
          </div>
          <h2>{isGitHub ? 'Create Pull Request' : 'Confirm Merge'}</h2>
          <button className="merge-confirm-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="merge-confirm-body">
          <div className="merge-confirm-message">
            {isGitHub ? (
              <>
                <p>Are you sure you want to create a pull request to merge:</p>
                <div className="merge-branch-flow">
                  <div className="branch-badge source-branch">
                    <span className="branch-icon">✨</span>
                    <span className="branch-name">{sourceBranch}</span>
                  </div>
                  <div className="merge-arrow">→</div>
                  <div className="branch-badge target-branch">
                    <span className="branch-icon">🧪</span>
                    <span className="branch-name">{targetBranch}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p>Are you sure you want to merge:</p>
                <div className="merge-branch-flow">
                  <div className="branch-badge source-branch">
                    <span className="branch-icon">✨</span>
                    <span className="branch-name">{sourceBranch}</span>
                  </div>
                  <div className="merge-arrow">→</div>
                  <div className="branch-badge target-branch">
                    <span className="branch-icon">🧪</span>
                    <span className="branch-name">{targetBranch}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <div className="merge-confirm-warning">
            <span className="warning-icon">⚠️</span>
            <span className="warning-text">
              {isGitHub 
                ? 'This will create a pull request on GitHub. You can review and merge it there.'
                : 'This action cannot be undone. Make sure you have committed all your changes.'}
            </span>
          </div>
        </div>
        
        <div className="merge-confirm-actions">
          <button className="merge-confirm-btn cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="merge-confirm-btn confirm-btn" onClick={onConfirm}>
            {isGitHub ? 'Create Pull Request' : 'Confirm Merge'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeConfirmationModal;
