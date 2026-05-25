#!/bin/bash
set -e
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Phase 1: Campaign History system — persistence, history page, detail page, activity timeline"
git push origin main
echo ""
echo "✅ Done! Vercel will auto-deploy in ~3 minutes."
echo ""
echo "⚠️  IMPORTANT: Run these commands to sync your local DB:"
echo "   npx prisma db push"
echo "   npx prisma generate"
