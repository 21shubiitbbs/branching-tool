import React from 'react';
import { useDrop } from 'react-dnd';
import { Branch } from '../services/api';
import BranchCard from './BranchCard';
import './BranchColumn.css';

interface BranchColumnProps {
  title: string;
  type: 'prod' | 'uat' | 'feature' | 'hotfix' | 'other';
  branches: Branch[];
  onDrop: (sourceBranch: string, targetBranch: string | null, columnType?: string) => void;
  onBranchDoubleClick?: (branchName: string) => void;
}

const BranchColumn: React.FC<BranchColumnProps> = ({ title, type, branches, onDrop, onBranchDoubleClick }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'BRANCH',
    drop: (item: { branchName: string }) => {
      // When dropping on a column (not a specific branch), pass null as targetBranch
      // and pass the column type so we can use it as prefix
      onDrop(item.branchName, null, type);
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
          <BranchCard key={branch.name} branch={branch} onDrop={onDrop} onDoubleClick={onBranchDoubleClick} />
        ))}
        {branches.length === 0 && (
          <div className="empty-column">No branches in this category</div>
        )}
      </div>
    </div>
  );
};

export default BranchColumn;
