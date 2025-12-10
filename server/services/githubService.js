const { Octokit } = require('@octokit/rest');

class GitHubService {
  constructor() {
    this.octokit = null;
    this.owner = null;
    this.repo = null;
    this.connected = false;
  }

  /**
   * Initialize GitHub connection with token
   */
  async connect(token, owner, repo) {
    try {
      this.octokit = new Octokit({
        auth: token,
      });

      // Verify connection by fetching repo info
      const { data } = await this.octokit.repos.get({ owner, repo });
      
      this.owner = owner;
      this.repo = repo;
      this.connected = true;

      return {
        success: true,
        repo: {
          name: data.name,
          fullName: data.full_name,
          description: data.description,
          defaultBranch: data.default_branch,
          private: data.private,
        }
      };
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to GitHub: ${error.message}`);
    }
  }

  /**
   * Disconnect from GitHub
   */
  disconnect() {
    this.octokit = null;
    this.owner = null;
    this.repo = null;
    this.connected = false;
  }

  /**
   * Check if connected to GitHub
   */
  isConnected() {
    return this.connected && this.octokit !== null;
  }

  /**
   * Get all branches from GitHub
   */
  async getAllBranches() {
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub');
    }

    try {
      const { data: branches } = await this.octokit.repos.listBranches({
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
      });

      // Get additional details for each branch
      const branchesWithDetails = await Promise.all(
        branches.map(async (branch) => {
          try {
            // Get latest commit for branch
            const { data: commit } = await this.octokit.repos.getCommit({
              owner: this.owner,
              repo: this.repo,
              ref: branch.name,
            });

            // Get branch protection status
            let isProtected = false;
            try {
              await this.octokit.repos.getBranchProtection({
                owner: this.owner,
                repo: this.repo,
                branch: branch.name,
              });
              isProtected = true;
            } catch (e) {
              // Branch is not protected
            }

            return {
              name: branch.name,
              current: false, // GitHub doesn't have a "current" branch concept
              type: this._getBranchType(branch.name),
              lastCommit: {
                hash: commit.sha.substring(0, 7),
                message: commit.commit.message.split('\n')[0],
                author: commit.commit.author.name,
                date: commit.commit.author.date,
              },
              isClean: true, // GitHub branches are always clean
              protected: isProtected,
              github: {
                sha: branch.commit.sha,
                url: branch.commit.url,
              }
            };
          } catch (error) {
            return {
              name: branch.name,
              current: false,
              type: this._getBranchType(branch.name),
              error: error.message,
            };
          }
        })
      );

      return branchesWithDetails;
    } catch (error) {
      throw new Error(`Failed to fetch branches from GitHub: ${error.message}`);
    }
  }

  /**
   * Get branch details from GitHub
   */
  async getBranchDetails(branchName) {
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub');
    }

    try {
      // Get branch info
      const { data: branch } = await this.octokit.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch: branchName,
      });

      // Get commits for branch
      const { data: commits } = await this.octokit.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        sha: branchName,
        per_page: 10,
      });

      // Compare with default branch to get ahead/behind
      let ahead = 0;
      let behind = 0;
      try {
        // Get default branch
        const { data: repoInfo } = await this.octokit.repos.get({
          owner: this.owner,
          repo: this.repo,
        });
        const defaultBranch = repoInfo.default_branch;

        // Compare branch with default branch
        const { data: compare } = await this.octokit.repos.compareCommits({
          owner: this.owner,
          repo: this.repo,
          base: defaultBranch,
          head: branchName,
        });
        ahead = compare.ahead_by || 0;
        behind = compare.behind_by || 0;
      } catch (e) {
        // Ignore comparison errors
      }

      return {
        name: branchName,
        type: this._getBranchType(branchName),
        commits: commits.map(commit => ({
          hash: commit.sha.substring(0, 7),
          message: commit.commit.message.split('\n')[0],
          author: commit.commit.author.name,
          date: commit.commit.author.date,
        })),
        ahead,
        behind,
        isClean: true,
        github: {
          sha: branch.commit.sha,
          url: branch._links.html,
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch branch details from GitHub: ${error.message}`);
    }
  }

  /**
   * Get diff between two branches from GitHub
   */
  async getDiff(sourceBranch, targetBranch) {
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub');
    }

    try {
      const { data: compare } = await this.octokit.repos.compareCommits({
        owner: this.owner,
        repo: this.repo,
        base: targetBranch,
        head: sourceBranch,
      });

      return {
        filesChanged: compare.files ? compare.files.length : 0,
        insertions: compare.files ? compare.files.reduce((sum, f) => sum + (f.additions || 0), 0) : 0,
        deletions: compare.files ? compare.files.reduce((sum, f) => sum + (f.deletions || 0), 0) : 0,
        files: compare.files ? compare.files.map(file => ({
          file: file.filename,
          changes: file.changes,
          insertions: file.additions,
          deletions: file.deletions,
          status: file.status,
        })) : [],
        diff: compare.patch || '',
        github: {
          htmlUrl: compare.html_url,
          diffUrl: compare.diff_url,
        }
      };
    } catch (error) {
      throw new Error(`Failed to get diff from GitHub: ${error.message}`);
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(sourceBranch, targetBranch, title, body) {
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub');
    }

    try {
      const { data: pr } = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: title || `Merge ${sourceBranch} into ${targetBranch}`,
        body: body || '',
        head: sourceBranch,
        base: targetBranch,
      });

      return {
        success: true,
        pr: {
          number: pr.number,
          title: pr.title,
          state: pr.state,
          url: pr.html_url,
          diffUrl: pr.diff_url,
        }
      };
    } catch (error) {
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }

  /**
   * Get pull requests for a branch
   */
  async getPullRequests(branchName = null, state = 'open') {
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub');
    }

    try {
      const params = {
        owner: this.owner,
        repo: this.repo,
        state,
        per_page: 100,
      };

      if (branchName) {
        params.head = `${this.owner}:${branchName}`;
      }

      const { data: prs } = await this.octokit.pulls.list(params);

      return prs.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch pull requests: ${error.message}`);
    }
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo() {
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub');
    }

    try {
      const { data: repo } = await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });

      return {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        defaultBranch: repo.default_branch,
        private: repo.private,
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        openIssues: repo.open_issues_count,
      };
    } catch (error) {
      throw new Error(`Failed to fetch repository info: ${error.message}`);
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

module.exports = new GitHubService();
