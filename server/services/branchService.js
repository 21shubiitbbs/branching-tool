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
      // Validate branch name
      if (!branchName || typeof branchName !== 'string' || branchName.trim() === '') {
        throw new Error('Invalid branch name provided');
      }
      
      // Check if branch name contains invalid characters or patterns
      if (branchName.includes('uncommitted') || branchName.includes('...') || branchName.includes('..')) {
        throw new Error(`Invalid branch name: ${branchName}`);
      }
      
      // Get all branches first to validate
      const branchSummary = await this.git.branchLocal();
      if (!branchSummary.all.includes(branchName)) {
        throw new Error(`Branch ${branchName} does not exist locally`);
      }
      
      const currentBranch = branchSummary.current;
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
   * Create a new branch from a source branch
   */
  async createBranch(newBranchName, sourceBranch) {
    try {
      // Check if branch already exists
      const branchSummary = await this.git.branchLocal();
      if (branchSummary.all.includes(newBranchName)) {
        throw new Error(`Branch ${newBranchName} already exists`);
      }

      // Check if source branch exists
      if (!branchSummary.all.includes(sourceBranch)) {
        throw new Error(`Source branch ${sourceBranch} does not exist`);
      }

      // Create and checkout the new branch from source
      await this.git.checkoutBranch(newBranchName, sourceBranch);

      return {
        success: true,
        message: `Branch ${newBranchName} created successfully from ${sourceBranch}`,
        branchName: newBranchName
      };
    } catch (error) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  /**
   * Get detailed uncommitted changes
   */
  async getUncommittedChanges() {
    try {
      const status = await this.git.status();
      
      return {
        hasChanges: !status.isClean(),
        modified: status.modified || [],
        created: status.created || [],
        deleted: status.deleted || [],
        not_added: status.not_added || [],
        conflicted: status.conflicted || [],
        staged: status.staged || [],
        files: [
          ...(status.modified || []),
          ...(status.created || []),
          ...(status.deleted || []),
          ...(status.not_added || [])
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get uncommitted changes: ${error.message}`);
    }
  }

  /**
   * Commit changes
   */
  async commitChanges(message) {
    try {
      const status = await this.git.status();
      
      // Add all changes
      await this.git.add('.');
      
      // Commit with message
      const commit = await this.git.commit(message);
      
      return {
        success: true,
        message: 'Changes committed successfully',
        commit: commit
      };
    } catch (error) {
      throw new Error(`Failed to commit changes: ${error.message}`);
    }
  }

  /**
   * Stash changes
   */
  async stashChanges(message) {
    try {
      const stash = await this.git.stash(['push', '-m', message || 'Stashed changes before checkout']);
      
      return {
        success: true,
        message: 'Changes stashed successfully',
        stash: stash
      };
    } catch (error) {
      throw new Error(`Failed to stash changes: ${error.message}`);
    }
  }

  /**
   * Discard all changes
   */
  async discardChanges() {
    try {
      // Reset all changes
      await this.git.reset(['--hard']);
      
      // Clean untracked files
      await this.git.clean('f', ['-d']);
      
      return {
        success: true,
        message: 'All changes discarded successfully'
      };
    } catch (error) {
      throw new Error(`Failed to discard changes: ${error.message}`);
    }
  }

  /**
   * Checkout to a branch and pull latest changes
   */
  async checkoutAndPull(branchName) {
    try {
      // Check if branch exists
      const branchSummary = await this.git.branchLocal();
      if (!branchSummary.all.includes(branchName)) {
        throw new Error(`Branch ${branchName} does not exist locally`);
      }

      // Check if there are uncommitted changes
      const status = await this.git.status();
      if (!status.isClean()) {
        // Return error with details about uncommitted changes
        const changes = await this.getUncommittedChanges();
        const error = new Error('You have uncommitted changes. Please commit or stash them before switching branches.');
        error.uncommittedChanges = changes;
        throw error;
      }

      // Fetch latest changes from remote
      try {
        await this.git.fetch();
      } catch (fetchError) {
        // If fetch fails (e.g., no remote), continue with checkout
        console.warn('Fetch failed, continuing with checkout:', fetchError.message);
      }

      // Checkout the branch
      await this.git.checkout(branchName);

      // Try to pull latest changes (if branch has upstream)
      let pullResult = null;
      try {
        // Check if branch has upstream tracking
        const branchInfo = await this.git.branch(['-vv']);
        const hasUpstream = branchInfo.all.some(b => {
          const branchData = branchInfo.branches[b];
          return branchData && branchData.name === branchName && branchData.upstream;
        });

        if (hasUpstream) {
          pullResult = await this.git.pull();
        } else {
          // No upstream, just checkout
          pullResult = { message: 'Branch has no upstream tracking. Checked out successfully.' };
        }
      } catch (pullError) {
        // If pull fails, still return success for checkout
        return {
          success: true,
          message: `Checked out to ${branchName} successfully, but pull failed: ${pullError.message}`,
          branchName: branchName,
          pullFailed: true,
          pullError: pullError.message
        };
      }

      return {
        success: true,
        message: `Checked out to ${branchName} and pulled latest changes successfully`,
        branchName: branchName,
        pullResult: pullResult
      };
    } catch (error) {
      throw new Error(`Failed to checkout and pull: ${error.message}`);
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
    if (branchName.startsWith('feature/') || branchName.startsWith('feat')) {
      return 'feature';
    }
    if (branchName.startsWith('hotfix/')) {
      return 'hotfix';
    }
    
    return 'other';
  }
}

module.exports = new BranchService();
