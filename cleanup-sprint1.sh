#!/bin/bash
# Sprint 1 Cleanup — Remove non-production files
# Run from: ~/Desktop/Nexus-ai
# Usage:    bash cleanup-sprint1.sh

set -e
cd "$(dirname "$0")"

echo "🧹 Sprint 1 Cleanup — Nexus AI"
echo "================================"

# Unsafe env backup
rm -f ".envr8_HKWnIB94sYe68FD1blD0aYFkRN3fnbo3VXaqQ" && echo "✓ removed .envr8_*"

# Old backup folder
rm -rf ".backup-old" && echo "✓ removed .backup-old/"

# Local runtime uploads
rm -rf ".storage" && echo "✓ removed .storage/"

# Nested duplicate project
rm -rf "Nexus-ai" && echo "✓ removed nested Nexus-ai/"

# Old zip
rm -f "Nexus-ai.zip" && echo "✓ removed Nexus-ai.zip"

# New nexus PDFs folder
rm -rf "new nexus" && echo "✓ removed new nexus/"

# Standalone legacy JS/HTML
rm -f "api/generate.js" "api/status.js" && rmdir "api" 2>/dev/null; echo "✓ removed api/"
rm -f "index.html" "index.html.backup" && echo "✓ removed index.html*"
rm -f "nexus-dashboard-standalone.html" "nexus-landing-v4.html" && echo "✓ removed standalone HTMLs"
rm -f "reference-dashboard.html" "reference-landing.html" && echo "✓ removed reference HTMLs"
rm -f "script.js" && echo "✓ removed script.js"
rm -f "push.sh" && echo "✓ removed push.sh"

# Stale build artifact
rm -f "tsconfig.tsbuildinfo" && echo "✓ removed tsconfig.tsbuildinfo"

# Internal docs not needed in repo
rm -f "FILE_INDEX.md" "NEXUS_AI_ORDER.md" "PROJECT_SUMMARY.md" ".agent.md" && echo "✓ removed internal docs"
rm -rf "docs" && echo "✓ removed docs/"

# Backup files inside src/
rm -f "src/app/dashboard/page.tsx.backup" && echo "✓ removed dashboard page.tsx.backup"
rm -f "src/app/page.tsx.backup" && echo "✓ removed app page.tsx.backup"
rm -f "src/components/CampaignWizard.tsx.backup" && echo "✓ removed CampaignWizard.tsx.backup"
find . -name "*.backup" -not -path "./.git/*" -delete && echo "✓ removed any remaining .backup files"

# macOS junk
find . -name ".DS_Store" -not -path "./.git/*" -delete && echo "✓ removed .DS_Store files"

echo ""
echo "✅ Cleanup complete."
echo "Note: .env kept for local dev (already gitignored)."
echo "Note: node_modules/.next/.git kept for local dev."
