/**
 * Branching Strategy Service
 * Enforces merge rules based on branch types
 */

class StrategyService {
  constructor() {
    // Define branch type patterns
    this.branchTypes = {
      prod: ['prod', 'production', 'main', 'master'],
      uat: ['uat', 'staging', 'pre-prod'],
      feature: /^(feature\/|feat)/,
      hotfix: /^hotfix\//
    };

    // Define allowed merge paths
    this.allowedMerges = [
      { from: 'feature', to: 'uat', description: 'Feature branches merge into UAT' },
      { from: 'uat', to: 'prod', description: 'UAT merges into Production' },
      { from: 'hotfix', to: 'prod', description: 'Hotfix branches merge into Production' },
      { from: 'hotfix', to: 'uat', description: 'Hotfix branches merge into UAT (back-merge)' },
    ];
  }

  /**
   * Determine the type of a branch
   */
  getBranchType(branchName) {
    const normalized = branchName.toLowerCase().trim();

    // Check exact matches for prod/uat
    if (this.branchTypes.prod.includes(normalized)) {
      return 'prod';
    }
    if (this.branchTypes.uat.includes(normalized)) {
      return 'uat';
    }

    // Check pattern matches
    if (this.branchTypes.feature.test(branchName)) {
      return 'feature';
    }
    if (this.branchTypes.hotfix.test(branchName)) {
      return 'hotfix';
    }

    // Default to 'other' for unknown branch types
    return 'other';
  }

  /**
   * Validate if a merge is allowed according to strategy
   */
  validateMerge(sourceBranch, targetBranch) {
    const sourceType = this.getBranchType(sourceBranch);
    const targetType = this.getBranchType(targetBranch);

    // Prevent merging from prod
    if (sourceType === 'prod') {
      return {
        allowed: false,
        reason: 'Cannot merge from production branch',
        sourceType,
        targetType
      };
    }

    // Prevent merging into feature/hotfix branches (except hotfix back-merge)
    if (targetType === 'feature' && sourceType !== 'hotfix') {
      return {
        allowed: false,
        reason: 'Cannot merge into feature branches',
        sourceType,
        targetType
      };
    }

    // Check if this merge path is explicitly allowed
    const isAllowed = this.allowedMerges.some(
      rule => rule.from === sourceType && rule.to === targetType
    );

    if (isAllowed) {
      const rule = this.allowedMerges.find(
        r => r.from === sourceType && r.to === targetType
      );
      return {
        allowed: true,
        reason: rule.description,
        sourceType,
        targetType
      };
    }

    // Default: not allowed
    return {
      allowed: false,
      reason: `Merging ${sourceType} into ${targetType} is not allowed by branching strategy`,
      sourceType,
      targetType
    };
  }

  /**
   * Get all allowed merge targets for a source branch
   */
  getAllowedTargets(sourceBranch) {
    const sourceType = this.getBranchType(sourceBranch);
    return this.allowedMerges
      .filter(rule => rule.from === sourceType)
      .map(rule => rule.to);
  }

  /**
   * Get merge rules for display
   */
  getMergeRules() {
    return this.allowedMerges;
  }
}

module.exports = new StrategyService();
