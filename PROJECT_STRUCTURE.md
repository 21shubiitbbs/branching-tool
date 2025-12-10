# 📁 Project Structure

```
branching-tool/
│
├── 📄 README.md                 # Main documentation
├── 📄 SETUP.md                  # Quick setup guide
├── 📄 FEATURES.md               # Creative features & ideas
├── 📄 PROJECT_STRUCTURE.md      # This file
├── 📄 package.json              # Root package.json with scripts
├── 📄 .gitignore               # Git ignore rules
├── 📄 setup.sh                 # Setup script
│
├── 🖥️ server/                   # Backend API
│   ├── index.js                # Express server & routes
│   ├── package.json            # Server dependencies
│   ├── .env.example            # Environment variables template
│   └── services/
│       ├── branchService.js    # Git branch operations
│       ├── mergeService.js     # Merge operations & history
│       └── strategyService.js  # Branching strategy validation
│
└── 🎨 client/                   # React Frontend
    ├── package.json            # Client dependencies
    ├── public/                 # Static assets
    └── src/
        ├── App.tsx             # Main app component
        ├── App.css            # App styles
        ├── index.tsx          # React entry point
        └── components/
            ├── BranchCard.tsx      # Draggable branch card
            ├── BranchCard.css
            ├── BranchColumn.tsx    # Drop zone column
            ├── BranchColumn.css
            ├── DiffModal.tsx       # Diff preview modal
            ├── DiffModal.css
            ├── MergeHistory.tsx    # Merge history modal
            └── MergeHistory.css
        └── services/
            └── api.ts         # API client (axios)

```

## 🔑 Key Files

### Backend

- **`server/index.js`**: Main Express server with all API routes
  - `GET /api/branches` - List all branches
  - `GET /api/branches/:name` - Get branch details
  - `GET /api/diff` - Get diff between branches
  - `POST /api/merge/validate` - Validate merge strategy
  - `POST /api/merge` - Perform merge
  - `GET /api/merges` - Get merge history
  - `GET /api/status` - Get repository status

- **`server/services/strategyService.js`**: Branching strategy logic
  - Defines allowed merge paths
  - Validates merge operations
  - Determines branch types

- **`server/services/branchService.js`**: Git branch operations
  - Fetches branch list
  - Gets branch details
  - Calculates diffs
  - Gets repository status

- **`server/services/mergeService.js`**: Merge operations
  - Performs merges
  - Records merge history
  - Handles merge conflicts

### Frontend

- **`client/src/App.tsx`**: Main application component
  - Manages state (branches, errors, modals)
  - Handles merge operations
  - Groups branches by type
  - Provides DnD context

- **`client/src/components/BranchCard.tsx`**: Individual branch card
  - Draggable branch representation
  - Drop target for other branches
  - Shows branch metadata

- **`client/src/components/BranchColumn.tsx`**: Column container
  - Groups branches by type
  - Drop zone for columns
  - Displays branch count

- **`client/src/components/DiffModal.tsx`**: Diff preview modal
  - Shows file changes
  - Displays diff statistics
  - Preview before merge

- **`client/src/components/MergeHistory.tsx`**: Merge history modal
  - Lists all merge operations
  - Shows success/failure status
  - Displays timestamps

- **`client/src/services/api.ts`**: API client
  - TypeScript interfaces
  - Axios-based HTTP client
  - All API endpoints

## 🔄 Data Flow

1. **User drags branch** → `BranchCard` uses `react-dnd` to start drag
2. **User drops on target** → `BranchCard` drop handler calls `onDrop`
3. **App validates merge** → Calls `branchApi.validateMerge()`
4. **App shows diff** → Calls `branchApi.getDiff()` and shows modal
5. **User confirms** → Calls `branchApi.performMerge()`
6. **Backend validates** → `strategyService` checks merge rules
7. **Backend merges** → `mergeService` performs git merge
8. **Backend records** → Saves to `.branching-tool-history.json`
9. **Frontend refreshes** → Reloads branches and history

## 🎨 Styling

- **Modern CSS** with flexbox/grid
- **Color-coded branches**: Prod (red), UAT (orange), Feature (blue), Hotfix (purple)
- **Responsive design** for mobile/tablet/desktop
- **Smooth animations** for drag-and-drop
- **Visual feedback** for drop targets

## 🔧 Configuration

- **Repository path**: Set in `server/.env` as `REPO_PATH`
- **Server port**: Set in `server/.env` as `PORT` (default: 3001)
- **CORS origin**: Set in `server/.env` as `CORS_ORIGIN` (default: http://localhost:3000)
- **Branch types**: Configured in `server/services/strategyService.js`

## 📦 Dependencies

### Backend
- `express` - Web framework
- `simple-git` - Git operations
- `cors` - CORS middleware
- `dotenv` - Environment variables

### Frontend
- `react` - UI library
- `react-dnd` - Drag and drop
- `react-dnd-html5-backend` - DnD backend
- `axios` - HTTP client
- `typescript` - Type safety

## 🚀 Scripts

- `npm run dev` - Start both servers
- `npm run server` - Start backend only
- `npm run client` - Start frontend only
- `npm run install-all` - Install all dependencies

---

**This structure is designed to be:**
- ✅ Easy to understand
- ✅ Easy to extend
- ✅ Well-organized
- ✅ Production-ready
