import React from 'react';
import { useDrag, useDrop, DragSourceMonitor, DropTargetMonitor } from 'react-dnd';
import { Branch } from '../services/api';
import './BranchCard.css';

interface BranchCardProps {
  branch: Branch;
  onDrop: (sourceBranch: string, targetBranch: string) => void;
  onDoubleClick?: (branchName: string) => void;
}

const BranchCard: React.FC<BranchCardProps> = ({ branch, onDrop, onDoubleClick }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'BRANCH',
    item: { branchName: branch.name },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'BRANCH',
    drop: (item: { branchName: string }) => {
      if (item.branchName !== branch.name) {
        onDrop(item.branchName, branch.name);
        return { handled: true }; // Return value to prevent parent drop handler from being called
      }
      return { handled: false };
    },
    collect: (monitor: DropTargetMonitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

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

  const cardRef = React.useRef<HTMLDivElement>(null);
  drag(drop(cardRef));

  const handleDoubleClick = () => {
    if (onDoubleClick && !branch.current) {
      onDoubleClick(branch.name);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`branch-card ${isDragging ? 'dragging' : ''} ${isOver && canDrop ? 'drop-target' : ''} ${branch.current ? 'current' : ''}`}
      style={{
        borderLeftColor: getTypeColor(branch.type),
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver && canDrop ? '#e0e7ff' : undefined,
        cursor: branch.current ? 'default' : 'pointer',
      }}
      onDoubleClick={handleDoubleClick}
      title={branch.current ? 'Current branch' : 'Double-click to checkout and pull'}
    >
      <div className="branch-header">
        <span className="branch-icon">{getTypeIcon(branch.type)}</span>
        <span className="branch-name">{branch.name}</span>
        {branch.current && <span className="current-badge">Current</span>}
      </div>
      {branch.lastCommit && (
        <div className="branch-details">
          <div className="commit-hash">{branch.lastCommit.hash}</div>
          <div className="commit-message" title={branch.lastCommit.message}>
            {branch.lastCommit.message.split('\n')[0].substring(0, 50)}
            {branch.lastCommit.message.length > 50 ? '...' : ''}
          </div>
          <div className="commit-author">{branch.lastCommit.author}</div>
        </div>
      )}
      {branch.isClean === false && (
        <div className="dirty-badge">Uncommitted changes</div>
      )}
      {branch.error && (
        <div className="error-badge">Error: {branch.error}</div>
      )}
    </div>
  );
};

export default BranchCard;
