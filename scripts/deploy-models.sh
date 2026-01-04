#!/bin/bash

# =============================================================================
# DEPLOY MODELS SCRIPT: Push model updates to model-deployment-branch
# =============================================================================
# This script pushes model changes to the model-deployment-branch
# instead of directly to main, following proper GitOps workflow.
# =============================================================================

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENT_BRANCH="model-deployment-branch"
MAIN_BRANCH="main"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Model Deployment Script${NC}"
echo -e "${BLUE}============================${NC}"

cd "$REPO_DIR"

# Step 1: Check for uncommitted changes
echo -e "${YELLOW}📋 Checking working directory...${NC}"
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  Uncommitted changes detected. Stashing...${NC}"
    git stash push -m "deploy-models-temp-stash"
    STASHED=true
else
    STASHED=false
fi

# Step 2: Fetch latest from remote
echo -e "${YELLOW}📥 Fetching latest from remote...${NC}"
git fetch origin

# Step 3: Checkout or create deployment branch
echo -e "${YELLOW}🔀 Switching to $DEPLOYMENT_BRANCH...${NC}"
if git show-ref --verify --quiet refs/remotes/origin/$DEPLOYMENT_BRANCH; then
    git checkout $DEPLOYMENT_BRANCH
    git pull origin $DEPLOYMENT_BRANCH
else
    git checkout -b $DEPLOYMENT_BRANCH
fi

# Step 4: Merge latest from main
echo -e "${YELLOW}🔄 Syncing with $MAIN_BRANCH...${NC}"
git fetch origin $MAIN_BRANCH
git merge origin/$MAIN_BRANCH --no-edit || {
    echo -e "${RED}❌ Merge conflict! Please resolve manually.${NC}"
    exit 1
}

# Step 5: Restore stashed changes if any
if [ "$STASHED" = true ]; then
    echo -e "${YELLOW}📦 Restoring stashed changes...${NC}"
    git stash pop || echo "No stash to pop"
fi

# Step 6: Check if there are model changes
echo -e "${YELLOW}📊 Checking for model changes...${NC}"
if [ -d "public/models" ]; then
    git add public/models/
fi
if [ -d "extras/ml-quant/training-logs" ]; then
    git add extras/ml-quant/training-logs/
fi
if [ -d "scripts/ml_training" ]; then
    git add scripts/ml_training/*.json 2>/dev/null || true
fi

if git diff --cached --quiet; then
    echo -e "${GREEN}✅ No model changes to deploy.${NC}"
    exit 0
fi

# Step 7: Commit changes
echo -e "${YELLOW}💾 Committing model updates...${NC}"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
git commit -m "🤖 Model Deployment: $TIMESTAMP"

# Step 8: Push to deployment branch
echo -e "${YELLOW}📤 Pushing to $DEPLOYMENT_BRANCH...${NC}"
git push origin $DEPLOYMENT_BRANCH -u

echo -e "${GREEN}✅ Model deployment complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "  1. Create a Pull Request from '$DEPLOYMENT_BRANCH' to '$MAIN_BRANCH'"
echo "  2. Review the model metrics and changes"
echo "  3. Merge the PR to deploy to production"
echo ""
echo -e "${GREEN}🌐 View PR at: https://github.com/buraq-hs51/alpha-mirage-private/compare/$MAIN_BRANCH...$DEPLOYMENT_BRANCH${NC}"
