#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "🔓 Removing git lock..."
rm -f .git/index.lock

echo "📦 Staging all files..."
git add -A

echo "💾 Committing..."
git commit -m "Production ready — full Next.js SaaS platform"

echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Done! Vercel will auto-deploy in ~2 minutes."
