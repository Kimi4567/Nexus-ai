# NEXUS AI — Vercel Deployment Guide

## Pre-flight Checklist

- [ ] `.env` is NOT committed to git (check with `git ls-files .env`)
- [ ] `npm run build` passes locally (TypeScript source: zero errors)
- [ ] All required environment variables are set in Vercel dashboard
- [ ] Supabase project is active and database is migrated (`npx prisma db push`)

---

## 1. Vercel Project Setup

1. Push the repo to GitHub (if not already done)
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: `/` (default)
5. Build command: `npm run build` (default)
6. Output directory: `.next` (default)

---

## 2. Environment Variables

Set these in: **Vercel Dashboard → Project → Settings → Environment Variables**

Apply to: **Production**, **Preview**, and **Development**

### Supabase (Required)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret — server only) |

### Database (Required)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Prisma connection string with `?pgbouncer=true` (port 6543) |
| `DIRECT_URL` | Direct connection without pgbouncer (port 5432) — used for migrations |

Example format:
```
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres
```

### OpenAI (Required — core AI functionality)
| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (GPT-4) |

### Cloudinary (Required — media uploads)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (public) |
| `CLOUDINARY_CLOUD_NAME` | Same cloud name (server-side) |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

### Lemon Squeezy — Billing (Required for paid plans)
| Variable | Description |
|---|---|
| `LEMONSQUEEZY_API_KEY` | Lemon Squeezy API key |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook signing secret (from LS dashboard) |
| `LS_STORE_ID` | Your Lemon Squeezy store ID |
| `LS_VARIANT_STARTER` | Variant ID for Starter plan |
| `LS_VARIANT_PRO` | Variant ID for Professional plan |
| `LS_VARIANT_AGENCY` | Variant ID for Business/Agency plan |

### Resend — Transactional Email (Required for auth emails)
| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key |

### Redis — Rate Limiting & Queues (Required)
| Variable | Description |
|---|---|
| `REDIS_URL` | Redis connection URL (Upstash recommended: `rediss://...`) |

### Meta / Facebook (Required for social publishing)
| Variable | Description |
|---|---|
| `META_APP_ID` | Meta developer app ID |
| `META_APP_SECRET` | Meta app secret |
| `NEXT_PUBLIC_META_APP_ID` | Same Meta app ID (exposed to client for OAuth flow) |

### App Config (Required)
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Your production URL, e.g. `https://nexus-grow.com` |
| `CRON_SECRET` | Random secret string to protect cron endpoints |
| `NODE_ENV` | `production` |

---

## 3. Database Migration

Run this **once** before first deployment (or after schema changes):

```bash
# From local machine with DIRECT_URL set in .env
npx prisma db push
```

Or for production-safe migrations:
```bash
npx prisma migrate deploy
```

After a schema push/deploy, apply the Supabase Data API lockdown migration
`supabase/migrations/20260715091427_reassert_public_data_api_lockdown.sql`
through the Supabase SQL Editor (or the reviewed Supabase migration pipeline).
It enables RLS on every `public` table and revokes browser-role table,
sequence, and function privileges. Re-run the security advisor after applying
it; this is a server-only Prisma architecture, so no browser table policies
are required.

---

## 4. Vercel Deployment Commands

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## 5. Post-Deployment Checks

- [ ] Visit `/` — landing page loads correctly
- [ ] Visit `/auth/login` — Supabase auth works
- [ ] Visit `/dashboard` — redirects to login if not authenticated
- [ ] Visit `/api/billing/status` with a valid token — returns JSON (not 500)
- [ ] Test Lemon Squeezy webhook by making a test purchase

---

## 6. Recommended Services (Free Tiers)

| Service | Free Tier | Use |
|---|---|---|
| Vercel | Hobby (free) | Hosting |
| Supabase | Free (500MB DB) | Auth + Database |
| Cloudinary | Free (25 credits/month) | Media uploads |
| Upstash Redis | Free (10k requests/day) | Rate limiting |
| Resend | Free (100 emails/day) | Transactional email |
| OpenAI | Pay-per-use | AI generation |
| Lemon Squeezy | Free (5% + $0.50/txn) | Billing |

**Estimated monthly burn on free tiers: ~$0–$5** (only OpenAI usage-based costs apply)

---

## 7. Custom Domain

1. Vercel Dashboard → Project → Settings → Domains
2. Add `nexus-grow.com` and `www.nexus-grow.com`
3. Update DNS records at your registrar as shown by Vercel
4. Update `NEXT_PUBLIC_APP_URL` to `https://nexus-grow.com`

---

## 8. Git Security Reminder

```bash
# Verify .env is not tracked
git ls-files .env

# If it shows up, remove it:
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "chore: remove .env from tracking"
git push
```

**Never commit real API keys.** All secrets live in Vercel environment variables only.
# Historical Deployment Notice

This file is a legacy deployment checklist. The current runtime contract is [`README.md`](README.md) plus [`.env.example`](.env.example); ignore legacy Lemon Squeezy, Starter/Agency, and NextAuth variables below.
