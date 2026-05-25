# Deployment Guide

This guide covers deploying NEXUS AI to production.

## Prerequisites

- GitHub repository
- Vercel account (https://vercel.com)
- PostgreSQL database (Railway, Supabase, or AWS RDS)
- Stripe account (https://stripe.com)
- Google OAuth credentials
- OpenAI API key
- Runway ML API key
- Cloudinary account

## Step-by-Step Deployment

### 1. Set Up PostgreSQL Database

#### Option A: Railway (Recommended for beginners)

```bash
# Visit https://railway.app
# Create account and new project
# Add PostgreSQL plugin
# Copy DATABASE_URL from environment variables
```

#### Option B: Supabase

```bash
# Visit https://supabase.com
# Create new project
# Copy connection string from settings
```

#### Option C: AWS RDS

```bash
# Create RDS PostgreSQL instance
# Configure security groups
# Get connection string
```

### 2. Create Vercel Project

```bash
# Option A: CLI
npm install -g vercel
vercel link

# Option B: Web
# Visit https://vercel.com/new
# Import from GitHub
# Select this repository
```

### 3. Configure Environment Variables in Vercel

In Vercel dashboard, go to **Settings > Environment Variables** and add:

```
# Database
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-domain.com

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# OpenAI
OPENAI_API_KEY=sk-...

# Runway ML
RUNWAY_API_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_AGENCY_PRICE_ID=price_...

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### 4. Run Database Migrations

```bash
# Local migration
DATABASE_URL="your-production-db-url" npx prisma migrate deploy

# Or via Vercel CLI
vercel env pull
npm run db:migrate
```

### 5. Configure Stripe

```bash
# Create products in Stripe dashboard
# Starter: $29/month
# Pro: $99/month
# Agency: $299/month

# Set up webhooks
# URL: https://your-domain.com/api/webhooks/stripe
# Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
```

### 6. Configure Google OAuth

```bash
# Go to Google Cloud Console
# Create OAuth 2.0 credentials
# Add authorized JavaScript origins:
#   - http://localhost:3000 (dev)
#   - https://your-domain.com (prod)
# Add authorized redirect URIs:
#   - http://localhost:3000/api/auth/callback/google (dev)
#   - https://your-domain.com/api/auth/callback/google (prod)
```

### 7. Deploy

```bash
# Push to main branch
git add .
git commit -m "Deploy to production"
git push origin main

# Vercel auto-deploys on push
# Monitor deployment at https://vercel.com/dashboard
```

## Post-Deployment

### 1. Verify Deployment

```bash
curl https://your-domain.com
# Should return 200 and HTML
```

### 2. Test Authentication

- Visit https://your-domain.com
- Sign up with email
- Verify email confirmation (mock in dev)
- Create workspace
- Create project

### 3. Test AI Integration

- Create campaign
- Verify AI strategy generation
- Check OpenAI API usage in dashboard

### 4. Test Stripe Integration

- Go to billing page
- Add subscription
- Use Stripe test card: 4242 4242 4242 4242
- Verify payment in Stripe dashboard

### 5. Monitor Logs

```bash
# View Vercel logs
vercel logs

# View Sentry errors (if configured)
# https://sentry.io/dashboard
```

## Monitoring & Maintenance

### Health Checks

Create a cron job to monitor:
- Database connection
- API response times
- Payment processing
- AI generation success rate

### Backups

- Enable automatic database backups
- Store backups in multiple regions
- Test restore procedure monthly

### Updates

```bash
# Keep dependencies updated
npm outdated
npm update

# Security updates
npm audit
npm audit fix
```

## Troubleshooting

### Deployment Fails

```bash
# Check build logs in Vercel
# Common issues:
# - Missing environment variables
# - Database migration error
# - Type errors

# Debug locally first
npm run build
npm run start
```

### Database Connection Error

```bash
# Verify DATABASE_URL is set
vercel env list

# Test connection
psql $DATABASE_URL

# Check firewall rules (for cloud DBs)
```

### Authentication Not Working

```bash
# Verify NEXTAUTH_SECRET is set
# Verify GOOGLE_CLIENT_ID/SECRET
# Check NextAuth logs in console

# Generate new secret
openssl rand -base64 32
```

### AI Generation Fails

```bash
# Check OpenAI API key is valid
# Verify API rate limits not exceeded
# Check request format matches API spec

# Enable debug logging
LOG_LEVEL=debug
```

## Scaling for Production

### Database Optimization

```bash
# Add indexes for frequently queried fields
CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX idx_generations_status ON generations(status);

# Regular maintenance
REINDEX;
VACUUM ANALYZE;
```

### Caching Layer

```bash
# Add Redis for:
# - Session caching
# - Rate limiting
# - Job queue
# - Real-time data

# Vercel KV (Redis alternative)
npm install @vercel/kv
```

### Background Jobs

```bash
# Implement job queue for:
# - AI generation processing
# - Email sending
# - Export generation
# - Webhook retries

# Use Bull/BullMQ with Redis
npm install bull
```

## Performance Optimization

### Frontend

- Enable image optimization
- Code splitting
- Preload critical resources
- Minify CSS/JS

### Backend

- Database query optimization
- API response caching
- Compression (gzip)
- CDN for static files

### Monitoring

- Set up Sentry for error tracking
- Enable performance monitoring
- Track Core Web Vitals
- Monitor database queries

## Security Checklist

- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] SQL injection prevented (Prisma)
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented
- [ ] API key rotation scheduled
- [ ] Database backups automated
- [ ] Audit logs enabled

## Support

For deployment issues:
1. Check Vercel documentation: https://vercel.com/docs
2. Check Next.js documentation: https://nextjs.org/docs
3. Check Prisma documentation: https://www.prisma.io/docs
4. Contact support: support@nexus-ai.com
