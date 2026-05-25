# NEXUS AI Architecture Guide

## System Overview

NEXUS AI is designed as a **scalable, production-grade AI SaaS platform**. This document outlines the architecture, data flow, and key components.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                             │
│  (Next.js frontend, React components, Tailwind CSS)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js App Server (Edge/Vercel)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Pages (UI)    │  API Routes   │  Middleware             │  │
│  ├────────────────┼───────────────┼────────────────────────┤  │
│  │ /auth/*        │ /api/auth/*   │ Authentication check   │  │
│  │ /dashboard     │ /api/campaigns│ Rate limiting          │  │
│  │ /campaign/*    │ /api/media    │ Logging                │  │
│  │ /workspace/*   │ /api/exports  │                        │  │
│  │ /onboarding    │ /api/webhooks │                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ┌────────┐    ┌─────────┐   ┌────────────┐
    │NextAuth│    │Prisma   │   │OpenAI API  │
    │(JWT)   │    │ORM      │   │            │
    └────────┘    └─────────┘   └────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  PostgreSQL      │
              │  Database        │
              │                  │
              │ Users            │
              │ Workspaces       │
              │ Projects         │
              │ Campaigns        │
              │ Media            │
              │ Generations      │
              │ Subscriptions    │
              └──────────────────┘
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ┌────────┐    ┌─────────┐   ┌────────────┐
    │Stripe  │    │Cloudinary│  │Runway ML   │
    │Payments│    │Storage  │   │Video Gen   │
    └────────┘    └─────────┘   └────────────┘
```

## Data Flow

### Campaign Creation Flow

```
User Input (Wizard)
    ↓
Form Validation (Client)
    ↓
POST /api/campaigns
    ↓
Create Campaign record (Prisma)
    ↓
Queue AI Jobs (Async)
    ├─ generateMarketingStrategy()
    └─ generateAdConcepts()
    ↓
Call OpenAI API
    ↓
Store Results in DB
    ↓
WebSocket/Polling Update (Client)
    ↓
Display on Campaign Page
```

### Video Generation Flow

```
User triggers "Generate Videos" on campaign
    ↓
POST /api/generations
    ↓
Create Generation record (QUEUED)
    ↓
Queue Job to background worker
    ↓
Worker calls Runway ML API
    ↓
Poll for completion
    ↓
POST /api/webhooks/generation (callback)
    ↓
Update Generation record (COMPLETED)
    ↓
Client polls or receives WebSocket update
    ↓
Display video in gallery
```

### Media Upload Flow

```
User uploads image/video
    ↓
Validate file (client)
    ↓
POST /api/media (multipart form)
    ↓
Upload to Cloudinary
    ↓
Store metadata in Prisma
    ↓
Return media record
    ↓
Display in media library
```

## Key Components

### 1. Authentication (`/src/lib/auth.ts`)

- NextAuth with JWT strategy
- Supports email/password + Google OAuth
- Protected API routes via `requireAuth()`
- Session validation on each request

### 2. Database ORM (`/src/lib/prisma.ts`)

- Prisma client singleton
- Connection pooling managed
- Automatic migrations
- Type-safe queries

### 3. AI Orchestration (`/src/lib/ai/`)

- `strategy.ts` — Marketing strategy generation
- `concepts.ts` — Ad concept creation
- `openai.ts` — OpenAI integration

### 4. Campaign Wizard (`/src/components/CampaignWizard.tsx`)

- 6-step guided flow
- Form validation
- State management
- Real-time error handling

### 5. API Routes (`/src/app/api/`)

- RESTful endpoints for all resources
- Error handling and validation
- Rate limiting (production)
- Webhook handlers for external services

### 6. Pages (`/src/app/`)

- Server-side rendering where possible
- Protected routes with redirects
- Streaming for real-time updates

## Database Schema

### Core Tables

**users**
- id (PK)
- email (UNIQUE)
- name, avatar
- passwordHash
- subscriptionStatus, aiCredits
- createdAt, updatedAt

**workspaces**
- id (PK)
- name, slug (UNIQUE)
- ownerId (FK to users)
- settings (JSON)

**projects**
- id (PK)
- name, description
- workspaceId (FK)
- businessType, businessInfo

**campaigns**
- id (PK)
- name, description
- projectId, workspaceId (FK)
- goal, audience, tone
- platforms (ARRAY)
- strategy (JSON)
- status

**generations**
- id (PK)
- campaignId (FK)
- type (VIDEO, IMAGE, AUDIO, POST)
- status (PENDING, QUEUED, PROCESSING, COMPLETED, FAILED)
- prompt, params
- output (URL)
- provider, externalId
- progress (0-100)
- error

**subscriptions**
- userId (UNIQUE, FK)
- plan (STARTER, PRO, AGENCY)
- status, stripeId
- currentPeriodStart, currentPeriodEnd
- monthlyCredits, monthlyExports

## API Rate Limiting

Production implementation:
- Per-user rate limits (tracked in Redis)
- AI credit system for expensive operations
- Stripe usage metering for billing
- Queue-based processing for long tasks

## Security

### Authentication
- Bcrypt password hashing
- JWT tokens with expiration
- CSRF protection via cookies
- Environment variables for secrets

### Authorization
- Workspace ownership check
- Project access verification
- Subscription tier validation
- API key restrictions

### Data Protection
- SQL injection prevention (Prisma)
- XSS protection (React/Next.js)
- CORS configuration
- Content Security Policy headers

## Scaling Strategy

### Horizontal Scaling
- Stateless Next.js servers
- Database connection pooling
- CDN for static assets
- Edge caching with Vercel

### Vertical Scaling
- Database optimization (indexes, queries)
- Caching layer (Redis)
- Background job queue (Bull/BullMQ)
- File upload optimization

### Asynchronous Processing
- Background jobs for AI generation
- Webhook callbacks for completion
- Message queue for reliability
- Dead letter queue for failures

## Monitoring & Observability

### Logging
- Application logs (console, file)
- API request logs
- Error tracking (Sentry)
- Audit logs for billing

### Metrics
- API response times
- Error rates
- Database query performance
- AI generation success rate
- User conversion funnel

### Alerts
- High error rates
- Slow queries
- Payment failures
- Service outages

## Deployment

### Development
```bash
npm run dev
```

### Staging
- Deploy to Vercel staging branch
- Use staging database
- Test integrations

### Production
- Deploy to main branch
- Automatic Vercel deployment
- Database backup before migration
- Gradual rollout

## Disaster Recovery

### Backup Strategy
- Daily automated database backups
- S3 cross-region replication
- Point-in-time recovery capability

### Failover
- Database replication
- CDN for static files
- Multiple app instances
- Health check monitoring

## Future Enhancements

1. **Real-time Collaboration**
   - WebSocket support for live editing
   - Operational transformation for conflicts

2. **Advanced Analytics**
   - Event tracking
   - Funnel analysis
   - Cohort analysis

3. **Machine Learning**
   - Performance prediction
   - Audience segmentation
   - Content recommendations

4. **Multi-region Deployment**
   - Geo-distributed database
   - Region-specific APIs
   - Latency optimization
