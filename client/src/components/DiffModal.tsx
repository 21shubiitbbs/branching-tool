import React from 'react';
import { Diff } from '../services/api';
import './DiffModal.css';

interface DiffModalProps {
  diff: Diff | null;
  sourceBranch: string;
  targetBranch: string;
  onClose: () => void;
}

const DiffModal: React.FC<DiffModalProps> = ({ diff, sourceBranch, targetBranch, onClose }) => {
  if (!diff) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Diff: {sourceBranch} → {targetBranch}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="diff-summary">
          <div className="summary-item">
            <span className="label">Files Changed:</span>
            <span className="value">{diff.filesChanged}</span>
          </div>
          <div className="summary-item">
            <span className="label">Insertions:</span>
            <span className="value positive">+{diff.insertions}</span>
          </div>
          <div className="summary-item">
            <span className="label">Deletions:</span>
            <span className="value negative">-{diff.deletions}</span>
          </div>
        </div>
        <div className="diff-files">
          <h3>Changed Files:</h3>
          <ul>
            {diff.files.map((file, index) => (
              <li key={index} className="file-item">
                <span className="file-name">{file.file}</span>
                <span className="file-stats">
                  <span className="positive">+{file.insertions}</span>
                  <span className="negative">-{file.deletions}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="diff-preview">
          <h3>Diff Preview:</h3>
          <pre className="diff-content">{diff.diff}</pre>
        </div>
      </div>
    </div>
  );
};

export default DiffModal;
