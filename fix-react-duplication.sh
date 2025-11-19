#!/bin/bash
# Emergency script to force clean React duplicates

echo "🧹 Emergency React cleanup..."

# Remove all possible cache locations
rm -rf node_modules/.vite
rm -rf node_modules/.cache
rm -rf .vite
rm -rf dist
rm -rf node_modules/.pnpm

# Remove and reinstall React specifically
npm uninstall react react-dom
npm install react@18.3.1 react-dom@18.3.1

echo "✅ Cleanup complete! Restart dev server."
