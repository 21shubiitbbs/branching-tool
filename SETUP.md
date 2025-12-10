# 🚀 Quick Setup Guide

## Step 1: Install Dependencies

Run the setup script:
```bash
./setup.sh
```

Or manually:
```bash
npm run install-all
```

## Step 2: Configure Repository Path

1. Copy the example environment file:
   ```bash
   cd server
   cp .env.example .env
   ```

2. Edit `server/.env` and set your Git repository path:
   ```env
   REPO_PATH=/absolute/path/to/your/git/repository
   PORT=3001
   CORS_ORIGIN=http://localhost:3000
   ```

   **Important**: Use an absolute path to your Git repository.

## Step 3: Start the Application

From the root directory:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend app on `http://localhost:3000`

## Step 4: Open in Browser

Navigate to: **http://localhost:3000**

## 🎯 First Use

1. You should see your branches organized by type (Prod, UAT, Feature, Hotfix)
2. Drag a branch card and drop it onto another branch to merge
3. Review the diff preview
4. Confirm the merge

## ⚠️ Troubleshooting

### "Failed to fetch branches"
- Verify `REPO_PATH` in `server/.env` is correct
- Ensure the path is absolute (starts with `/`)
- Check you have read/write permissions to the repository

### Port already in use
- Change `PORT` in `server/.env` to a different port (e.g., 3002)
- Update `CORS_ORIGIN` to match

### CORS errors
- Ensure `CORS_ORIGIN` in `server/.env` matches your frontend URL
- Default is `http://localhost:3000`

## 📚 Next Steps

- Read the [README.md](README.md) for detailed documentation
- Check [FEATURES.md](FEATURES.md) for enhancement ideas
- Customize the branching strategy in `server/services/strategyService.js`

---

**Need help?** Check the main README or open an issue!
