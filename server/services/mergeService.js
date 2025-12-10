const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

class MergeService {
  constructor() {
    this.git = null;
    this.repoPath = null;
    this.historyFile = null;
  }

  initialize(repoPath) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    this.historyFile = path.join(repoPath, '.branching-tool-history.json');
  }

  /**
   * Perform merge between two branches
   */
  async merge(sourceBranch, targetBranch, mergeMessage = null) {
    try {
      const currentBranch = (await this.git.branchLocal()).current;
      
      // Checkout target branch
      await this.git.checkout(targetBranch);
      
      // Fetch latest changes
      await this.git.fetch();
      
      // Pull latest changes for target branch
      try {
        await this.git.pull('origin', targetBranch);
      } catch (error) {
        // Ignore if branch doesn't exist on remote
      }

      // Perform merge
      const mergeMessageText = mergeMessage || `Merge ${sourceBranch} into ${targetBranch}`;
      const mergeResult = await this.git.merge([sourceBranch, '--no-ff', '-m', mergeMessageText]);

      // Record merge in history
      await this._recordMerge(sourceBranch, targetBranch, mergeMessageText, 'success');

      // Return to original branch if it was different
      if (currentBranch !== targetBranch) {
        await this.git.checkout(currentBranch);
      }

      return {
        success: true,
        message: `Successfully merged ${sourceBranch} into ${targetBranch}`,
        mergeResult: mergeResult.summary || 'Merge completed'
      };
    } catch (error) {
      // Record failed merge
      await this._recordMerge(sourceBranch, targetBranch, mergeMessage, 'failed', error.message);

      // Check if it's a merge conflict
      if (error.message.includes('conflict') || error.message.includes('CONFLICT')) {
        return {
          success: false,
          error: 'Merge conflict detected',
          message: error.message,
          requiresResolution: true
        };
      }

      throw new Error(`Merge failed: ${error.message}`);
    }
  }

  /**
   * Record merge in history file
   */
  async _recordMerge(sourceBranch, targetBranch, message, status, error = null) {
    try {
      let history = [];
      
      // Read existing history if file exists
      try {
        const historyContent = await fs.readFile(this.historyFile, 'utf8');
        history = JSON.parse(historyContent);
      } catch (e) {
        // File doesn't exist, start fresh
      }

      // Add new merge record
      history.unshift({
        id: Date.now().toString(),
        sourceBranch,
        targetBranch,
        message: message || `Merge ${sourceBranch} into ${targetBranch}`,
        status,
        error,
        timestamp: new Date().toISOString()
      });

      // Keep only last 100 records
      if (history.length > 100) {
        history = history.slice(0, 100);
      }

      // Write back to file
      await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Failed to record merge history:', error);
      // Don't throw - history is not critical
    }
  }

  /**
   * Get merge history
   */
  async getMergeHistory(limit = 50) {
    try {
      const historyContent = await fs.readFile(this.historyFile, 'utf8');
      const history = JSON.parse(historyContent);
      return history.slice(0, limit);
    } catch (error) {
      // File doesn't exist or is invalid
      return [];
    }
  }

  /**
   * Abort a merge (if in progress)
   */
  async abortMerge() {
    try {
      await this.git.merge(['--abort']);
      return { success: true, message: 'Merge aborted successfully' };
    } catch (error) {
      throw new Error(`Failed to abort merge: ${error.message}`);
    }
  }
}

module.exports = new MergeService();
