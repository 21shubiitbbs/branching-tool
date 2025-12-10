import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Branch {
  name: string;
  current: boolean;
  type: 'prod' | 'uat' | 'feature' | 'hotfix' | 'other';
  lastCommit?: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };
  isClean?: boolean;
  error?: string;
}

export interface Diff {
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: Array<{
    file: string;
    changes: number;
    insertions: number;
    deletions: number;
  }>;
  diff: string;
}

export interface MergeValidation {
  allowed: boolean;
  reason: string;
  sourceType: string;
  targetType: string;
}

export interface MergeResult {
  success: boolean;
  message?: string;
  error?: string;
  requiresResolution?: boolean;
  mergeResult?: string;
}

export interface MergeHistory {
  id: string;
  sourceBranch: string;
  targetBranch: string;
  message: string;
  status: 'success' | 'failed';
  error?: string;
  timestamp: string;
}

export const branchApi = {
  getAllBranches: async (): Promise<Branch[]> => {
    const response = await api.get('/branches');
    return response.data;
  },

  getBranchDetails: async (branchName: string) => {
    const response = await api.get(`/branches/${branchName}`);
    return response.data;
  },

  getDiff: async (source: string, target: string): Promise<Diff> => {
    const response = await api.get('/diff', { params: { source, target } });
    return response.data;
  },

  validateMerge: async (source: string, target: string): Promise<MergeValidation> => {
    const response = await api.post('/merge/validate', { source, target });
    return response.data;
  },

  performMerge: async (source: string, target: string, message?: string): Promise<MergeResult> => {
    const response = await api.post('/merge', { source, target, message });
    return response.data;
  },

  getMergeHistory: async (): Promise<MergeHistory[]> => {
    const response = await api.get('/merges');
    return response.data;
  },

  getRepositoryStatus: async () => {
    const response = await api.get('/status');
    return response.data;
  },

  createBranch: async (newBranchName: string, sourceBranch: string) => {
    const response = await api.post('/branches/create', { newBranchName, sourceBranch });
    return response.data;
  },

  checkoutAndPull: async (branchName: string) => {
    const response = await api.post('/branches/checkout', { branchName });
    return response.data;
  },

  getUncommittedChanges: async () => {
    const response = await api.get('/branches/uncommitted');
    return response.data;
  },

  commitChanges: async (message: string) => {
    const response = await api.post('/branches/commit', { message });
    return response.data;
  },

  stashChanges: async (message?: string) => {
    const response = await api.post('/branches/stash', { message });
    return response.data;
  },

  discardChanges: async () => {
    const response = await api.post('/branches/discard');
    return response.data;
  },
};

// ========== GitHub API ==========

export interface GitHubRepo {
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  private: boolean;
  url?: string;
  stars?: number;
  forks?: number;
  openIssues?: number;
}

export interface GitHubConnectionStatus {
  connected: boolean;
  repo?: GitHubRepo;
  error?: string;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  sourceBranch: string;
  targetBranch: string;
  url: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export const githubApi = {
  connect: async (token: string, owner: string, repo: string) => {
    const response = await api.post('/github/connect', { token, owner, repo });
    return response.data;
  },

  disconnect: async () => {
    const response = await api.post('/github/disconnect');
    return response.data;
  },

  getStatus: async (): Promise<GitHubConnectionStatus> => {
    const response = await api.get('/github/status');
    return response.data;
  },

  getAllBranches: async (): Promise<Branch[]> => {
    const response = await api.get('/github/branches');
    return response.data;
  },

  getBranchDetails: async (branchName: string) => {
    const response = await api.get(`/github/branches/${branchName}`);
    return response.data;
  },

  getDiff: async (source: string, target: string): Promise<Diff> => {
    const response = await api.get('/github/diff', { params: { source, target } });
    return response.data;
  },

  createPullRequest: async (source: string, target: string, title?: string, body?: string) => {
    const response = await api.post('/github/pull-request', { source, target, title, body });
    return response.data;
  },

  getPullRequests: async (branch?: string, state: string = 'open'): Promise<PullRequest[]> => {
    const response = await api.get('/github/pull-requests', { 
      params: { branch, state } 
    });
    return response.data;
  },

  createBranch: async (newBranchName: string, sourceBranch: string) => {
    const response = await api.post('/github/branches/create', { newBranchName, sourceBranch });
    return response.data;
  },

  checkoutAndPull: async (branchName: string) => {
    const response = await api.post('/github/branches/checkout', { branchName });
    return response.data;
  },
};
