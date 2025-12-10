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
}

const BranchColumn: React.FC<BranchColumnProps> = ({ title, type, branches, onDrop }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'BRANCH',
    drop: (item: { branchName: string }) => {
      // When dropping on a column, we need to find a target branch
      // For now, we'll use the first branch in the column or the column type
      if (branches.length > 0) {
        onDrop(item.branchName, branches[0].name);
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
          <BranchCard key={branch.name} branch={branch} onDrop={onDrop} />
        ))}
        {branches.length === 0 && (
          <div className="empty-column">No branches in this category</div>
        )}
      </div>
    </div>
  );
};

export default BranchColumn;
