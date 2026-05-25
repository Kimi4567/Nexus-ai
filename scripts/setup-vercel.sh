#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# NEXUS AI — Vercel Deployment Setup Script
# Run this once before deploying to Vercel for the first time
# ═══════════════════════════════════════════════════════════════

set -e

echo ""
echo "═══════════════════════════════════════════════════"
echo "  NEXUS AI — Vercel Environment Variable Setup"
echo "═══════════════════════════════════════════════════"
echo ""

# Check vercel CLI
if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm install -g vercel
fi

echo "Logging in to Vercel (if not already)..."
vercel whoami 2>/dev/null || vercel login

echo ""
echo "Linking project to Vercel..."
vercel link

echo ""
echo "Setting required environment variables..."
echo "(You will be prompted to enter each value)"
echo ""

read_and_set() {
  local KEY=$1
  local DESCRIPTION=$2
  echo "→ $KEY"
  echo "  $DESCRIPTION"
  read -rsp "  Value: " VALUE
  echo ""
  echo "$VALUE" | vercel env add "$KEY" production
  echo "  ✓ Set"
  echo ""
}

# Supabase
read_and_set "NEXT_PUBLIC_SUPABASE_URL" "Supabase project URL (https://xxx.supabase.co)"
read_and_set "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Supabase publishable/anon key (sb_publishable_...)"
read_and_set "SUPABASE_SERVICE_ROLE_KEY" "Supabase service role key (sb_secret_...)"

# Database
read_and_set "DATABASE_URL" "PostgreSQL connection string (with %26%26 encoded password)"
read_and_set "DIRECT_URL" "Same as DATABASE_URL (for Prisma migrations)"

# OpenAI
read_and_set "OPENAI_API_KEY" "OpenAI API key (sk-...)"

# Stripe (optional — skip by pressing Enter)
echo "→ STRIPE_SECRET_KEY (optional — press Enter to skip)"
read -rsp "  Value: " STRIPE_SK
echo ""
if [ -n "$STRIPE_SK" ]; then
  echo "$STRIPE_SK" | vercel env add STRIPE_SECRET_KEY production
  echo "  ✓ Set"
fi
echo ""

echo "→ STRIPE_WEBHOOK_SECRET (optional — press Enter to skip)"
read -rsp "  Value: " STRIPE_WH
echo ""
if [ -n "$STRIPE_WH" ]; then
  echo "$STRIPE_WH" | vercel env add STRIPE_WEBHOOK_SECRET production
  echo "  ✓ Set"
fi
echo ""

echo "→ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (optional — press Enter to skip)"
read -rsp "  Value: " STRIPE_PK
echo ""
if [ -n "$STRIPE_PK" ]; then
  echo "$STRIPE_PK" | vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
  echo "  ✓ Set"
fi
echo ""

# Cloudinary (optional)
echo "→ CLOUDINARY_CLOUD_NAME (optional — press Enter to skip)"
read -rsp "  Value: " CLD_NAME
echo ""
if [ -n "$CLD_NAME" ]; then
  echo "$CLD_NAME" | vercel env add CLOUDINARY_CLOUD_NAME production
  echo "$CLD_NAME" | vercel env add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME production
  echo "  ✓ Set"
fi
echo ""

echo "═══════════════════════════════════════════════════"
echo "  ✓ Environment variables configured!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Run: npx prisma db push     (push schema to Supabase)"
echo "  2. Run: vercel --prod           (deploy to production)"
echo "  3. Set your Supabase redirect URL to your Vercel domain"
echo "     Dashboard → Authentication → URL Configuration"
echo "     Site URL: https://your-app.vercel.app"
echo "     Redirect URLs: https://your-app.vercel.app/**"
echo ""
