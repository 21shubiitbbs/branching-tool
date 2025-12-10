import React from 'react';
import { MergeHistory as MergeHistoryType } from '../services/api';
import './MergeHistory.css';

interface MergeHistoryProps {
  history: MergeHistoryType[];
  onClose: () => void;
}

const MergeHistory: React.FC<MergeHistoryProps> = ({ history, onClose }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="history-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Merge History</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="history-list">
          {history.length === 0 ? (
            <div className="empty-history">No merge history yet</div>
          ) : (
            history.map((item) => (
              <div key={item.id} className={`history-item ${item.status}`}>
                <div className="history-header">
                  <span className="merge-path">
                    {item.sourceBranch} → {item.targetBranch}
                  </span>
                  <span className={`status-badge ${item.status}`}>
                    {item.status === 'success' ? '✓ Success' : '✗ Failed'}
                  </span>
                </div>
                <div className="history-message">{item.message}</div>
                <div className="history-footer">
                  <span className="history-time">{formatDate(item.timestamp)}</span>
                  {item.error && (
                    <span className="history-error">{item.error}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MergeHistory;
