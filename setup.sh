#!/bin/bash

# Branching Tool Setup Script
echo "🌿 Setting up Branching Tool..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install
cd ..

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "📝 Next steps:"
echo "1. Create server/.env file:"
echo "   cp server/.env.example server/.env"
echo ""
echo "2. Edit server/.env and set your repository path:"
echo "   REPO_PATH=/path/to/your/git/repository"
echo ""
echo "3. Start the application:"
echo "   npm run dev"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "Happy branching! 🌿"
