#!/bin/bash
set -e
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Fix: analytics 500, copyright year, forgot-password, privacy & terms pages"
git push origin main
echo ""
echo "✅ Done! Vercel will auto-deploy in ~2 minutes."
