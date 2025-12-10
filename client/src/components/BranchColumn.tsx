import React from 'react';
import { useDrop } from 'react-dnd';
import { Branch } from '../services/api';
import BranchCard from './BranchCard';
import './BranchColumn.css';

interface BranchColumnProps {
  title: string;
  type: 'prod' | 'uat' | 'feature' | 'hotfix' | 'other';
  branches: Branch[];
  onDrop: (sourceBranch: string, targetBranch: string) => void;
  onCreateBranch?: (sourceBranch: string, targetType: 'prod' | 'uat' | 'feature' | 'hotfix' | 'other') => void;
  onCheckout?: (branchName: string) => void;
}

const BranchColumn: React.FC<BranchColumnProps> = ({ title, type, branches, onDrop, onCreateBranch, onCheckout }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'BRANCH',
    drop: (item: { branchName: string }, monitor) => {
      // Check if we're dropping on a branch card (not the column itself)
      // If a nested drop target (BranchCard) handled the drop, didDrop() will be true
      const didDropOnCard = monitor.didDrop();
      
      // Only handle column drop if no card handled it
      if (!didDropOnCard) {
        // If we have onCreateBranch handler, create new branch
        if (onCreateBranch) {
          onCreateBranch(item.branchName, type);
        } else if (branches.length > 0) {
          // Fallback to old behavior if no onCreateBranch handler
          onDrop(item.branchName, branches[0].name);
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const getColumnColor = () => {
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

  return (
    <div
      ref={drop}
      className={`branch-column ${isOver ? 'drag-over' : ''} ${canDrop ? 'can-drop' : ''}`}
      style={{
        borderTopColor: getColumnColor(),
      }}
    >
      <div className="column-header">
        <h2>{title}</h2>
        <span className="branch-count">{branches.length}</span>
      </div>
      <div className="branch-list">
        {branches.map((branch) => (
          <BranchCard key={branch.name} branch={branch} onDrop={onDrop} onDoubleClick={onCheckout} />
        ))}
        {branches.length === 0 && (
          <div className="empty-column">No branches in this category</div>
        )}
      </div>
    </div>
  );
};

export default BranchColumn;
