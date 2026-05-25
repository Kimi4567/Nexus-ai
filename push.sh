#!/bin/bash
set -e
cd "$(dirname "$0")"
rm -f .git/index.lock
git add -A
git commit -m "Phase 2: Sidebar navigation, dashboard redesign, brand intelligence system

- Linear-style persistent sidebar (Sidebar.tsx + AppShell.tsx)
- Dashboard redesigned as operational command center
- BrandProfile model added to Prisma schema
- /brand page — full brand intelligence editor
- /api/brand — brand profile CRUD API
- AI generation injects brand profile context into every campaign
- All authenticated pages migrated from NavBar to AppShell
- Type-check passes clean"
git push origin main
echo ""
echo "✅ Done! Vercel will auto-deploy in ~3 minutes."
echo ""
echo "⚠️  IMPORTANT: Run these to sync the DB with new BrandProfile table:"
echo "   npx prisma db push"
echo "   npx prisma generate"
