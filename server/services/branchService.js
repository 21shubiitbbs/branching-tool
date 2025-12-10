const simpleGit = require('simple-git');
const path = require('path');

class BranchService {
  constructor() {
    this.git = null;
    this.repoPath = null;
  }

  initialize(repoPath) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Get all branches with metadata
   */
  async getAllBranches() {
    try {
      const branchSummary = await this.git.branchLocal();
      const branches = branchSummary.all.map(branch => ({
        name: branch,
        current: branch === branchSummary.current,
        type: this._getBranchType(branch)
      }));

      // Get additional details for each branch
      const branchesWithDetails = await Promise.all(
        branches.map(async (branch) => {
          try {
            const log = await this.git.log({ from: branch.name, maxCount: 1 });
            const status = await this.git.status();
            
            return {
              ...branch,
              lastCommit: log.latest ? {
                hash: log.latest.hash.substring(0, 7),
                message: log.latest.message,
                author: log.latest.author_name,
                date: log.latest.date
              } : null,
              isClean: status.isClean()
            };
          } catch (error) {
            return { ...branch, error: error.message };
          }
        })
      );

      return branchesWithDetails;
    } catch (error) {
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }

  /**
   * Get detailed information about a specific branch
   */
  async getBranchDetails(branchName) {
    try {
      const currentBranch = (await this.git.branchLocal()).current;
      const log = await this.git.log({ from: branchName, maxCount: 10 });
      const status = await this.git.status();

      // Get ahead/behind info if not on the branch
      let ahead = 0;
      let behind = 0;
      if (currentBranch !== branchName) {
        try {
          await this.git.fetch();
          const branchStatus = await this.git.branch(['-vv']);
          // This is a simplified version - you might want to enhance this
        } catch (e) {
          // Ignore fetch errors
        }
      }

      return {
        name: branchName,
        type: this._getBranchType(branchName),
        commits: log.all.map(commit => ({
          hash: commit.hash.substring(0, 7),
          message: commit.message,
          author: commit.author_name,
          date: commit.date
        })),
        ahead,
        behind,
        isClean: status.isClean()
      };
    } catch (error) {
      throw new Error(`Failed to fetch branch details: ${error.message}`);
    }
  }

  /**
   * Get diff between two branches
   */
  async getDiff(sourceBranch, targetBranch) {
    try {
      const diffSummary = await this.git.diffSummary([sourceBranch, targetBranch]);
      const diff = await this.git.diff([sourceBranch, targetBranch]);
      
      return {
        filesChanged: diffSummary.files.length,
        insertions: diffSummary.insertions,
        deletions: diffSummary.deletions,
        files: diffSummary.files.map(file => ({
          file: file.file,
          changes: file.changes,
          insertions: file.insertions,
          deletions: file.deletions
        })),
        diff: diff.substring(0, 10000) // Limit diff size for performance
      };
    } catch (error) {
      throw new Error(`Failed to get diff: ${error.message}`);
    }
  }

  /**
   * Get repository status
   */
  async getRepositoryStatus() {
    try {
      const status = await this.git.status();
      const currentBranch = (await this.git.branchLocal()).current;
      
      return {
        currentBranch,
        isClean: status.isClean(),
        hasUncommittedChanges: !status.isClean(),
        modifiedFiles: status.modified,
        untrackedFiles: status.not_added
      };
    } catch (error) {
      throw new Error(`Failed to get repository status: ${error.message}`);
    }
  }

  /**
   * Helper to determine branch type
   */
  _getBranchType(branchName) {
    const normalized = branchName.toLowerCase().trim();
    
    if (['prod', 'production', 'main', 'master'].includes(normalized)) {
      return 'prod';
    }
    if (['uat', 'staging', 'pre-prod'].includes(normalized)) {
      return 'uat';
    }
    if (branchName.startsWith('feature/')) {
      return 'feature';
    }
    if (branchName.startsWith('hotfix/')) {
      return 'hotfix';
    }
    
    return 'other';
  }
}

module.exports = new BranchService();
