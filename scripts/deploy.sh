#!/bin/bash

# =============================================================================
# DEPLOY SCRIPT: Private Code → Public Website
# =============================================================================
# This script builds your React app and deploys only the built files
# to a separate public repository, keeping your source code private.
# =============================================================================

set -e  # Exit on any error

# Configuration
PRIVATE_REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_REPO_DIR="$(cd "$PRIVATE_REPO_DIR/../alpha-mirage" && pwd)"
PUBLIC_REPO_URL="https://github.com/buraq-hs51/alpha-mirage.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting deployment...${NC}"

# Step 1: Build the project
echo -e "${YELLOW}📦 Building the project...${NC}"
cd "$PRIVATE_REPO_DIR"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed: dist folder not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build complete${NC}"

# Step 2: Copy build files to public repo
echo -e "${YELLOW}📋 Copying files to public repo...${NC}"

# Clear old files (except .git)
cd "$PUBLIC_REPO_DIR"
find . -maxdepth 1 ! -name '.git' ! -name '.' ! -name '..' -exec rm -rf {} +

# Copy new build
cp -r "$PRIVATE_REPO_DIR/dist/"* "$PUBLIC_REPO_DIR/"

# Add .nojekyll to bypass Jekyll processing on GitHub Pages
touch .nojekyll

echo -e "${GREEN}✅ Files copied${NC}"

# Step 3: Commit and push
echo -e "${YELLOW}📤 Pushing to public repo...${NC}"

git add -A
COMMIT_MSG="Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$COMMIT_MSG" || echo "No changes to commit"
git push origin main || git push -u origin main

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}🌐 Your site will be live at: https://buraq-hs51.github.io/alpha-mirage/${NC}"
