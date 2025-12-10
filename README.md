# 🌿 Branching Tool

A beautiful drag-and-drop Git branch merging tool with branching strategy enforcement. Merge branches by simply dragging and dropping them!

## ✨ Features

- **🎯 Drag & Drop Merging**: Intuitively drag branches onto each other to merge
- **🛡️ Strategy Enforcement**: Automatically validates merges based on your branching strategy
- **📊 Diff Preview**: See what will change before merging
- **📜 Merge History**: Track all merge operations
- **🎨 Beautiful UI**: Modern, responsive interface with visual feedback
- **⚡ Real-time Updates**: Auto-refreshes branch status
- **🐙 GitHub Integration**: Connect to GitHub repositories for real-time updates
- **🔌 WebSocket Support**: Live updates when branches change on GitHub
- **📝 Pull Request Creation**: Create PRs instead of direct merges when using GitHub

## 🏗️ Branching Strategy

The tool enforces the following merge rules:

### Allowed Merges:
- ✅ `feature/*` → `uat`
- ✅ `uat` → `prod`
- ✅ `hotfix/*` → `prod`
- ✅ `hotfix/*` → `uat` (back-merge)

### Blocked Merges:
- ❌ `feature/*` → `prod` (must go through UAT first)
- ❌ `prod` → anything (production is read-only)
- ❌ Direct merges into feature branches

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- A Git repository (local or remote)

### Installation

1. **Clone or navigate to the project:**
   ```bash
   cd branching-tool
   ```

2. **Install all dependencies:**
   ```bash
   npm run install-all
   ```

3. **Configure the repository path:**
   
   Create `server/.env` file:
   ```bash
   cd server
   cp .env.example .env
   ```
   
   Edit `server/.env` and set your repository path:
   ```env
   REPO_PATH=/path/to/your/git/repository
   PORT=3001
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start the application:**
   ```bash
   # From the root directory
   npm run dev
   ```
   
   This starts both:
   - Backend server on `http://localhost:3001`
   - Frontend app on `http://localhost:3000`

5. **Open your browser:**
   Navigate to `http://localhost:3000`

## 📖 Usage

### Merging Branches

1. **Drag a branch card** from any column
2. **Drop it onto another branch** in a different column
3. **Review the diff** preview (if available)
4. **Confirm the merge** when prompted
5. The merge will be performed according to your branching strategy

### Viewing Merge History

Click the **"📜 History"** button in the header to see all merge operations, including successes and failures.

### Refreshing Branches

Click the **"🔄 Refresh"** button to reload branch information from your repository.

### GitHub Integration

The tool supports real-time integration with GitHub repositories:

1. **Connect to GitHub:**
   - Click the "Connect to GitHub" button in the header
   - Enter your GitHub Personal Access Token
   - Provide the repository owner and name
   - Click "Connect"

2. **Using GitHub Branches:**
   - Once connected, you can switch between local Git and GitHub branches
   - Click the "🐙 GitHub" button to view GitHub branches
   - Real-time updates are automatically received via WebSocket

3. **Creating Pull Requests:**
   - When connected to GitHub, dragging and dropping branches creates a pull request instead of a direct merge
   - The PR will be created on GitHub and you'll be redirected to view it

4. **Real-time Updates:**
   - Branch updates from GitHub are automatically reflected in the UI
   - WebSocket connection provides instant notifications when branches are pushed, created, or deleted
   - You can also set up GitHub webhooks for even faster updates

5. **GitHub Webhooks (Optional):**
   - Configure a webhook in your GitHub repository pointing to: `http://your-server:3001/api/github/webhook`
   - This enables instant updates when changes occur on GitHub

## 🎨 Creative Features

### Current Features:
- **Visual Branch Types**: Color-coded branches (Prod=Red, UAT=Orange, Feature=Blue, Hotfix=Purple)
- **Diff Preview**: See file changes before merging
- **Merge History**: Track all merge operations
- **Real-time Validation**: Instant feedback on allowed/blocked merges
- **Branch Status**: See uncommitted changes, last commit info

### Future Enhancement Ideas:
- 🔔 **Notifications**: Slack/Email notifications on merges
- 📈 **Analytics Dashboard**: Merge frequency, branch lifecycle metrics
- 🔐 **User Authentication**: Multi-user support with permissions
- 🤖 **CI/CD Integration**: Trigger builds on successful merges
- 📝 **Merge Templates**: Pre-filled merge messages
- 🔍 **Advanced Search**: Filter branches by name, author, date
- 📊 **Branch Graph**: Visual representation of branch relationships
- ⚙️ **Custom Strategies**: Configure your own merge rules
- 🔄 **Auto-sync**: Automatic branch synchronization with remote

## 🏛️ Architecture

```
branching-tool/
├── server/                 # Backend API
│   ├── index.js           # Express server with WebSocket
│   ├── services/
│   │   ├── branchService.js    # Git branch operations
│   │   ├── mergeService.js     # Merge operations
│   │   ├── strategyService.js  # Strategy validation
│   │   └── githubService.js    # GitHub API integration
│   └── package.json
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.tsx        # Main app component
│   │   ├── components/    # React components
│   │   │   └── GitHubConnection.tsx  # GitHub connection UI
│   │   └── services/      # API client & WebSocket
│   │       ├── api.ts     # REST API client
│   │       └── websocket.ts  # WebSocket client
│   └── package.json
└── README.md
```

## 🔧 Configuration

### Backend Configuration (`server/.env`)

```env
# Required: Path to your Git repository
REPO_PATH=/path/to/your/repo

# Optional: Server port (default: 3001)
PORT=3001

# Optional: CORS origin (default: http://localhost:3000)
CORS_ORIGIN=http://localhost:3000
```

### Branch Type Detection

The tool automatically detects branch types based on:
- **Production**: `prod`, `production`, `main`, `master`
- **UAT**: `uat`, `staging`, `pre-prod`
- **Feature**: Branches starting with `feature/`
- **Hotfix**: Branches starting with `hotfix/`

## 🛠️ Development

### Running in Development Mode

```bash
# Start both servers with hot-reload
npm run dev
```

### Running Separately

```bash
# Backend only
npm run server

# Frontend only
npm run client
```

### Project Structure

- **Backend**: Node.js + Express + simple-git + Octokit + Socket.IO
- **Frontend**: React + TypeScript + react-dnd + Socket.IO Client
- **Styling**: CSS with modern design patterns

## 🐛 Troubleshooting

### "Failed to fetch branches"
- Check that `REPO_PATH` in `server/.env` points to a valid Git repository
- Ensure you have read/write permissions to the repository

### "Merge conflict detected"
- Resolve conflicts manually in your Git repository
- The tool will show this error and you'll need to fix it in your terminal/IDE

### CORS errors
- Ensure `CORS_ORIGIN` in `server/.env` matches your frontend URL
- Default is `http://localhost:3000`

### GitHub Connection Issues
- Verify your Personal Access Token has the `repo` scope
- Ensure the repository owner and name are correct
- Check that the token hasn't expired
- For webhooks, ensure your server is publicly accessible or use a tunneling service like ngrok

## 📝 License

MIT

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 💡 Tips

1. **Always review the diff** before confirming a merge
2. **Check merge history** to track what's been merged
3. **Use feature branches** for new development
4. **Keep branches clean** - commit or stash changes before merging
5. **Test in UAT first** - never merge directly to production from features

---

**Happy Branching! 🌿**