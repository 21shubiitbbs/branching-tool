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
   * Create a new branch from source branch with prefix from drop branch
   */
  async createBranchWithPrefix(sourceBranch, prefixBranch) {
    try {
      // Check if branches exist
      const branchSummary = await this.git.branchLocal();
      if (!branchSummary.all.includes(sourceBranch)) {
        throw new Error(`Source branch ${sourceBranch} does not exist`);
      }
      if (!branchSummary.all.includes(prefixBranch)) {
        throw new Error(`Prefix branch ${prefixBranch} does not exist`);
      }

      // Extract prefix from prefixBranch (e.g., "prod/main" -> "prod", "feature/test" -> "feature")
      const prefix = prefixBranch.includes('/') ? prefixBranch.split('/')[0] : prefixBranch;

      // Extract branch name from sourceBranch (remove existing prefix if any)
      // e.g., "feature/my-feature" -> "my-feature", "hotfix/bug-fix" -> "bug-fix"
      let branchName = sourceBranch;
      if (sourceBranch.includes('/')) {
        branchName = sourceBranch.split('/').slice(1).join('/');
      }

      // Create new branch name with prefix
      const newBranchName = `${prefix}/${branchName}`;

      // Check if branch already exists
      if (branchSummary.all.includes(newBranchName)) {
        throw new Error(`Branch ${newBranchName} already exists`);
      }

      // Create and checkout the new branch from source
      await this.git.checkoutBranch(newBranchName, sourceBranch);

      return {
        success: true,
        message: `Branch ${newBranchName} created successfully from ${sourceBranch} with prefix from ${prefixBranch}`,
        branchName: newBranchName
      };
    } catch (error) {
      throw new Error(`Failed to create branch with prefix: ${error.message}`);
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
      
      // Add all files - use --all flag to include all changes
      // This is equivalent to 'git add -A' which adds all files including untracked
      await this.git.raw(['add', '--all']);
      
      // Verify what was staged
      const statusAfterAdd = await this.git.status();
      
      // If there are still files not staged, add them explicitly
      if (statusAfterAdd.not_added && statusAfterAdd.not_added.length > 0) {
        for (const file of statusAfterAdd.not_added) {
          try {
            await this.git.add(file);
          } catch (err) {
            console.warn(`Failed to add file ${file}:`, err.message);
          }
        }
      }
      
      // Also ensure modified files are staged
      if (statusAfterAdd.modified && statusAfterAdd.modified.length > 0) {
        for (const file of statusAfterAdd.modified) {
          try {
            await this.git.add(file);
          } catch (err) {
            console.warn(`Failed to add modified file ${file}:`, err.message);
          }
        }
      }
      
      // Final check before commit
      const finalStatusBeforeCommit = await this.git.status();
      
      // Commit with message
      const commit = await this.git.commit(message);
      
      // Verify commit was successful by checking status
      const finalStatus = await this.git.status();
      
      if (!finalStatus.isClean()) {
        const remaining = {
          modified: finalStatus.modified || [],
          not_added: finalStatus.not_added || [],
          deleted: finalStatus.deleted || [],
          created: finalStatus.created || []
        };
        console.warn('Warning: Working directory is not clean after commit. Remaining changes:', remaining);
        
        // Try to add and commit remaining files
        if (remaining.not_added.length > 0 || remaining.modified.length > 0) {
          try {
            // Add remaining files
            await this.git.raw(['add', '--all']);
            const statusAfterRetry = await this.git.status();
            
            // If there are staged files, commit them
            if (statusAfterRetry.staged && statusAfterRetry.staged.length > 0) {
              await this.git.commit(`${message} (additional files)`);
              const finalStatusAfterRetry = await this.git.status();
              
              if (!finalStatusAfterRetry.isClean()) {
                console.warn('Still have uncommitted changes after retry:', finalStatusAfterRetry);
              }
            }
          } catch (retryError) {
            console.error('Failed to commit remaining files:', retryError.message);
          }
        }
      }
      
      // Final status check
      const ultimateStatus = await this.git.status();
      
      return {
        success: true,
        message: 'Changes committed successfully',
        commit: commit,
        isClean: ultimateStatus.isClean(),
        hadRemainingChanges: !finalStatus.isClean()
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
   * Push changes to remote branch
   */
  async pushChanges(branchName = null) {
    try {
      // Get current branch if not specified
      if (!branchName) {
        const branchSummary = await this.git.branchLocal();
        branchName = branchSummary.current;
      }

      // Push to remote
      const pushResult = await this.git.push('origin', branchName);
      
      return {
        success: true,
        message: `Changes pushed successfully to ${branchName}`,
        pushResult: pushResult
      };
    } catch (error) {
      throw new Error(`Failed to push changes: ${error.message}`);
    }
  }

  /**
   * Commit and push changes
   */
  async commitAndPush(message, branchName = null) {
    try {
      // Commit changes first (this will handle retrying if needed)
      const commitResult = await this.commitChanges(message);
      
      // Verify working directory is clean after commit
      const statusAfterCommit = await this.git.status();
      
      if (!statusAfterCommit.isClean()) {
        // If still not clean, this is a problem - we can't proceed
        const remaining = {
          modified: statusAfterCommit.modified || [],
          not_added: statusAfterCommit.not_added || [],
          deleted: statusAfterCommit.deleted || [],
          created: statusAfterCommit.created || []
        };
        throw new Error(`Cannot push: Working directory is not clean after commit. Remaining files: ${JSON.stringify(remaining)}`);
      }
      
      // Working directory is clean, proceed with push
      const pushResult = await this.pushChanges(branchName);
      
      // Final verification that we're still clean
      const finalStatus = await this.git.status();
      
      if (!finalStatus.isClean()) {
        console.warn('Warning: Working directory has changes after push:', finalStatus);
      }
      
      return {
        success: true,
        message: `Changes committed and pushed successfully`,
        pushResult: pushResult,
        isClean: finalStatus.isClean(),
        commitResult: commitResult
      };
    } catch (error) {
      throw new Error(`Failed to commit and push: ${error.message}`);
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
