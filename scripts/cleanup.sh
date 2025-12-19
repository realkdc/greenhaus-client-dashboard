#!/bin/bash

# Cleanup script for GreenHaus Admin project
# Removes build artifacts and caches to reduce folder size

echo "🧹 Cleaning up project folder..."

# Remove Next.js build cache
if [ -d ".next" ]; then
  rm -rf .next
  echo "✓ Removed .next build cache"
fi

# Remove node_modules (optional - uncomment if you want to clean this too)
# echo "⚠️  Removing node_modules (run 'npm install' after this)"
# rm -rf node_modules

# Remove any .DS_Store files (Mac system files)
find . -name ".DS_Store" -delete 2>/dev/null
echo "✓ Removed .DS_Store files"

# Remove temporary files
find . -name "*.log" -type f -delete 2>/dev/null
echo "✓ Removed log files"

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "To reinstall dependencies: npm install"
echo "To rebuild: npm run build"
