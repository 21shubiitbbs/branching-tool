const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const branchService = require('./services/branchService');
const mergeService = require('./services/mergeService');
const strategyService = require('./services/strategyService');
const githubService = require('./services/githubService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;
const REPO_PATH = process.env.REPO_PATH || process.cwd();

// Middleware
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'http://localhost:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Initialize Git service
branchService.initialize(REPO_PATH);
mergeService.initialize(REPO_PATH);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', repoPath: REPO_PATH });
});

// Get all branches with metadata
app.get('/api/branches', async (req, res) => {
  try {
    const branches = await branchService.getAllBranches();
    res.json(branches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new branch from a source branch (must be before /api/branches/:branchName)
app.post('/api/branches/create', async (req, res) => {
  try {
    const { newBranchName, sourceBranch } = req.body;
    if (!newBranchName || !sourceBranch) {
      return res.status(400).json({ error: 'New branch name and source branch are required' });
    }

    const result = await branchService.createBranch(newBranchName, sourceBranch);
    res.json(result);
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new branch with prefix from drop branch
app.post('/api/branches/create-with-prefix', async (req, res) => {
  try {
    const { sourceBranch, prefixBranch } = req.body;
    if (!sourceBranch || !prefixBranch) {
      return res.status(400).json({ error: 'Source branch and prefix branch are required' });
    }

    const result = await branchService.createBranchWithPrefix(sourceBranch, prefixBranch);
    res.json(result);
  } catch (error) {
    console.error('Error creating branch with prefix:', error);
    res.status(500).json({ error: error.message });
  }
});

// Checkout to a branch and pull latest changes
app.post('/api/branches/checkout', async (req, res) => {
  try {
    const { branchName } = req.body;
    if (!branchName) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    const result = await branchService.checkoutAndPull(branchName);
    res.json(result);
  } catch (error) {
    console.error('Error checking out branch:', error);
    // If error has uncommitted changes details, include them
    if (error.uncommittedChanges) {
      return res.status(400).json({ 
        error: error.message,
        uncommittedChanges: error.uncommittedChanges,
        code: 'UNCOMMITTED_CHANGES'
      });
    }
    // Check if error message mentions uncommitted changes
    if (error.message && (error.message.includes('uncommitted changes') || error.message.includes('Please commit or stash'))) {
      // Try to get uncommitted changes details
      try {
        const changes = await branchService.getUncommittedChanges();
        return res.status(400).json({ 
          error: error.message,
          uncommittedChanges: changes,
          code: 'UNCOMMITTED_CHANGES'
        });
      } catch (fetchErr) {
        // If we can't fetch changes, just return the error
        return res.status(400).json({ 
          error: error.message,
          code: 'UNCOMMITTED_CHANGES'
        });
      }
    }
    res.status(500).json({ error: error.message });
  }
});

// Get uncommitted changes
app.get('/api/branches/uncommitted', async (req, res) => {
  try {
    const changes = await branchService.getUncommittedChanges();
    res.json(changes);
  } catch (error) {
    console.error('Error getting uncommitted changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Commit changes
app.post('/api/branches/commit', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Commit message is required' });
    }

    const result = await branchService.commitChanges(message);
    res.json(result);
  } catch (error) {
    console.error('Error committing changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stash changes
app.post('/api/branches/stash', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await branchService.stashChanges(message);
    res.json(result);
  } catch (error) {
    console.error('Error stashing changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Discard changes
app.post('/api/branches/discard', async (req, res) => {
  try {
    const result = await branchService.discardChanges();
    res.json(result);
  } catch (error) {
    console.error('Error discarding changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Push changes to remote
app.post('/api/branches/push', async (req, res) => {
  try {
    const { branchName } = req.body;
    const result = await branchService.pushChanges(branchName);
    res.json(result);
  } catch (error) {
    console.error('Error pushing changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Commit and push changes
app.post('/api/branches/commit-and-push', async (req, res) => {
  try {
    const { message, branchName } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Commit message is required' });
    }
    const result = await branchService.commitAndPush(message, branchName);
    res.json(result);
  } catch (error) {
    console.error('Error committing and pushing changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get branch details (commits ahead/behind, last commit, etc.)
app.get('/api/branches/:branchName', async (req, res) => {
  try {
    let { branchName } = req.params;
    
    // Decode URL-encoded branch names
    branchName = decodeURIComponent(branchName);
    
    // Validate branch name - prevent invalid branch names
    if (!branchName || branchName.trim() === '' || branchName.includes('uncommitted') || branchName.includes('...')) {
      return res.status(400).json({ error: 'Invalid branch name' });
    }
    
    // Validate branch name format (basic validation)
    if (!/^[a-zA-Z0-9._\-\/]+$/.test(branchName)) {
      return res.status(400).json({ error: 'Invalid branch name format' });
    }
    
    const details = await branchService.getBranchDetails(branchName);
    res.json(details);
  } catch (error) {
    console.error('Error fetching branch details:', error);
    // Check if it's a "branch not found" type error
    if (error.message && (error.message.includes('unknown revision') || error.message.includes('not in the working tree'))) {
      return res.status(404).json({ error: `Branch not found: ${req.params.branchName}` });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get diff between two branches
app.get('/api/diff', async (req, res) => {
  try {
    const { source, target } = req.query;
    if (!source || !target) {
      return res.status(400).json({ error: 'Source and target branches are required' });
    }
    const diff = await branchService.getDiff(source, target);
    res.json(diff);
  } catch (error) {
    console.error('Error fetching diff:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate merge strategy
app.post('/api/merge/validate', async (req, res) => {
  try {
    const { source, target } = req.body;
    if (!source || !target) {
      return res.status(400).json({ error: 'Source and target branches are required' });
    }
    
    const validation = strategyService.validateMerge(source, target);
    res.json(validation);
  } catch (error) {
    console.error('Error validating merge:', error);
    res.status(500).json({ error: error.message });
  }
});

// Perform merge
app.post('/api/merge', async (req, res) => {
  try {
    const { source, target, message } = req.body;
    if (!source || !target) {
      return res.status(400).json({ error: 'Source and target branches are required' });
    }

    // Validate merge strategy
    const validation = strategyService.validateMerge(source, target);
    if (!validation.allowed) {
      return res.status(403).json(validation);
    }

    // Perform merge
    const result = await mergeService.merge(source, target, message);
    res.json(result);
  } catch (error) {
    console.error('Error performing merge:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get merge history
app.get('/api/merges', async (req, res) => {
  try {
    const history = await mergeService.getMergeHistory();
    res.json(history);
  } catch (error) {
    console.error('Error fetching merge history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get repository status
app.get('/api/status', async (req, res) => {
  try {
    const status = await branchService.getRepositoryStatus();
    res.json(status);
  } catch (error) {
    console.error('Error fetching repository status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GitHub Integration Endpoints ==========

// Connect to GitHub
app.post('/api/github/connect', async (req, res) => {
  try {
    const { token, owner, repo } = req.body;
    if (!token || !owner || !repo) {
      return res.status(400).json({ error: 'Token, owner, and repo are required' });
    }

    const result = await githubService.connect(token, owner, repo);
    
    // Emit connection event to all clients
    io.emit('github:connected', result);
    
    res.json(result);
  } catch (error) {
    console.error('Error connecting to GitHub:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect from GitHub
app.post('/api/github/disconnect', async (req, res) => {
  try {
    githubService.disconnect();
    io.emit('github:disconnected');
    res.json({ success: true, message: 'Disconnected from GitHub' });
  } catch (error) {
    console.error('Error disconnecting from GitHub:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get GitHub connection status
app.get('/api/github/status', async (req, res) => {
  try {
    const connected = githubService.isConnected();
    if (connected) {
      const repoInfo = await githubService.getRepositoryInfo();
      res.json({ connected: true, repo: repoInfo });
    } else {
      res.json({ connected: false });
    }
  } catch (error) {
    console.error('Error fetching GitHub status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get branches from GitHub
app.get('/api/github/branches', async (req, res) => {
  try {
    if (!githubService.isConnected()) {
      return res.status(400).json({ error: 'Not connected to GitHub' });
    }
    const branches = await githubService.getAllBranches();
    res.json(branches);
  } catch (error) {
    console.error('Error fetching GitHub branches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get branch details from GitHub
app.get('/api/github/branches/:branchName', async (req, res) => {
  try {
    if (!githubService.isConnected()) {
      return res.status(400).json({ error: 'Not connected to GitHub' });
    }
    const { branchName } = req.params;
    const details = await githubService.getBranchDetails(branchName);
    res.json(details);
  } catch (error) {
    console.error('Error fetching GitHub branch details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get diff from GitHub
app.get('/api/github/diff', async (req, res) => {
  try {
    if (!githubService.isConnected()) {
      return res.status(400).json({ error: 'Not connected to GitHub' });
    }
    const { source, target } = req.query;
    if (!source || !target) {
      return res.status(400).json({ error: 'Source and target branches are required' });
    }
    const diff = await githubService.getDiff(source, target);
    res.json(diff);
  } catch (error) {
    console.error('Error fetching GitHub diff:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create pull request
app.post('/api/github/pull-request', async (req, res) => {
  try {
    if (!githubService.isConnected()) {
      return res.status(400).json({ error: 'Not connected to GitHub' });
    }
    const { source, target, title, body } = req.body;
    if (!source || !target) {
      return res.status(400).json({ error: 'Source and target branches are required' });
    }

    const result = await githubService.createPullRequest(source, target, title, body);
    
    // Emit PR creation event
    io.emit('github:pr-created', result);
    
    res.json(result);
  } catch (error) {
    console.error('Error creating pull request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get pull requests
app.get('/api/github/pull-requests', async (req, res) => {
  try {
    if (!githubService.isConnected()) {
      return res.status(400).json({ error: 'Not connected to GitHub' });
    }
    const { branch, state } = req.query;
    const prs = await githubService.getPullRequests(branch, state || 'open');
    res.json(prs);
  } catch (error) {
    console.error('Error fetching pull requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new branch from a source branch (GitHub)
app.post('/api/github/branches/create', async (req, res) => {
  try {
    if (!githubService.isConnected()) {
      return res.status(400).json({ error: 'Not connected to GitHub' });
    }
    const { newBranchName, sourceBranch } = req.body;
    if (!newBranchName || !sourceBranch) {
      return res.status(400).json({ error: 'New branch name and source branch are required' });
    }

    const result = await githubService.createBranch(newBranchName, sourceBranch);
    
    // Emit branch creation event
    io.emit('github:branch-created', result);
    
    // Refresh branches
    try {
      const branches = await githubService.getAllBranches();
      io.emit('github:branches-updated', branches);
    } catch (e) {
      console.error('Error refreshing branches after creation:', e);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error creating GitHub branch:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new branch with prefix from drop branch (GitHub)
app.post('/api/github/branches/create-with-prefix', async (req, res) => {
  try {
    if (!githubService.isConnected()) {
      return res.status(400).json({ error: 'Not connected to GitHub' });
    }
    const { sourceBranch, prefixBranch } = req.body;
    if (!sourceBranch || !prefixBranch) {
      return res.status(400).json({ error: 'Source branch and prefix branch are required' });
    }

    const result = await githubService.createBranchWithPrefix(sourceBranch, prefixBranch);
    
    // Emit branch creation event
    io.emit('github:branch-created', result);
    
    // Refresh branches
    try {
      const branches = await githubService.getAllBranches();
      io.emit('github:branches-updated', branches);
    } catch (e) {
      console.error('Error refreshing branches after creation:', e);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error creating GitHub branch with prefix:', error);
    res.status(500).json({ error: error.message });
  }
});

// Checkout to a branch and pull latest changes (GitHub)
app.post('/api/github/branches/checkout', async (req, res) => {
  try {
    if (!githubService.isConnected()) {
      return res.status(400).json({ error: 'Not connected to GitHub' });
    }
    const { branchName } = req.body;
    if (!branchName) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    const result = await githubService.checkoutAndPull(branchName, REPO_PATH);
    
    // Refresh branches after checkout
    try {
      const branches = await githubService.getAllBranches();
      io.emit('github:branches-updated', branches);
    } catch (e) {
      console.error('Error refreshing branches after checkout:', e);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error checking out GitHub branch:', error);
    res.status(500).json({ error: error.message });
  }
});

// GitHub webhook endpoint for real-time updates
app.post('/api/github/webhook', async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const payload = req.body;

    // Acknowledge webhook immediately
    res.status(200).json({ received: true });

    // Process webhook events
    switch (event) {
      case 'push':
        // Branch was pushed to
        io.emit('github:push', {
          ref: payload.ref,
          branch: payload.ref.replace('refs/heads/', ''),
          commits: payload.commits,
          pusher: payload.pusher,
        });
        // Refresh branches
        if (githubService.isConnected()) {
          try {
            const branches = await githubService.getAllBranches();
            io.emit('github:branches-updated', branches);
          } catch (e) {
            console.error('Error refreshing branches after push:', e);
          }
        }
        break;

      case 'pull_request':
        // PR was opened, closed, or merged
        io.emit('github:pull-request', {
          action: payload.action,
          pr: {
            number: payload.pull_request.number,
            title: payload.pull_request.title,
            state: payload.pull_request.state,
            sourceBranch: payload.pull_request.head.ref,
            targetBranch: payload.pull_request.base.ref,
            url: payload.pull_request.html_url,
          }
        });
        break;

      case 'create':
        // Branch or tag was created
        if (payload.ref_type === 'branch') {
          io.emit('github:branch-created', {
            branch: payload.ref,
            sha: payload.sha,
          });
        }
        break;

      case 'delete':
        // Branch or tag was deleted
        if (payload.ref_type === 'branch') {
          io.emit('github:branch-deleted', {
            branch: payload.ref,
          });
        }
        break;

      default:
        console.log(`Unhandled GitHub event: ${event}`);
    }
  } catch (error) {
    console.error('Error processing GitHub webhook:', error);
  }
});

// ========== WebSocket Connection Handling ==========

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current GitHub connection status
  socket.on('github:get-status', async () => {
    try {
      const connected = githubService.isConnected();
      if (connected) {
        const repoInfo = await githubService.getRepositoryInfo();
        socket.emit('github:status', { connected: true, repo: repoInfo });
      } else {
        socket.emit('github:status', { connected: false });
      }
    } catch (error) {
      socket.emit('github:status', { connected: false, error: error.message });
    }
  });

  // Request branch refresh
  socket.on('github:refresh-branches', async () => {
    if (githubService.isConnected()) {
      try {
        const branches = await githubService.getAllBranches();
        socket.emit('github:branches-updated', branches);
      } catch (error) {
        socket.emit('github:error', { message: error.message });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Poll GitHub for updates every 30 seconds if connected
setInterval(async () => {
  if (githubService.isConnected()) {
    try {
      const branches = await githubService.getAllBranches();
      io.emit('github:branches-updated', branches);
    } catch (error) {
      console.error('Error polling GitHub branches:', error);
    }
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`🚀 Branching Tool Server running on port ${PORT}`);
  console.log(`📁 Repository path: ${REPO_PATH}`);
  console.log(`🔌 WebSocket server ready`);
});
