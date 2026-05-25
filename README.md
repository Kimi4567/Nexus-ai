# NEXUS AI — Production-Grade AI Marketing Operating System

This is a **complete, scalable, venture-backed-quality** AI SaaS platform for creating professional marketing campaigns.

## Overview

NEXUS AI is built for businesses that need complete marketing solutions—not just video generation. The platform acts as an "in-house marketing agency" that:

- Analyzes business type and goals
- Generates data-driven marketing strategies
- Creates multiple ad concepts and variations
- Generates scripts, captions, and CTAs
- Produces video, image, and audio assets
- Exports to multiple formats
- Integrates with social platforms

## Technology Stack

**Frontend:**
- Next.js 14
- React 18
- Tailwind CSS
- Framer Motion (animations)

**Backend:**
- Node.js (Next.js API routes)
- Prisma ORM
- PostgreSQL

**AI & Content:**
- OpenAI GPT-4
- Runway ML (video generation)
- Cloudinary (media storage)

**Payments & Auth:**
- Stripe (billing)
- NextAuth (authentication)
- JWT sessions

**Infrastructure:**
- Vercel (deployment)
- PostgreSQL on Railway/Supabase
- Background jobs with webhooks

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Auth pages
│   ├── dashboard/         # Main dashboard
│   ├── campaign/          # Campaign management
│   ├── workspace/         # Workspace pages
│   └── onboarding/        # Onboarding flow
├── components/            # React components
│   └── CampaignWizard.tsx # 6-step campaign wizard
├── lib/                   # Utilities
│   ├── auth.ts            # NextAuth config
│   ├── prisma.ts          # Prisma client
│   ├── stripe.ts          # Stripe integration
│   ├── ai/                # AI orchestration
│   │   ├── strategy.ts    # Marketing strategy
│   │   ├── concepts.ts    # Ad concepts
│   │   └── openai.ts      # OpenAI API
│   └── utils.ts           # Helper functions
└── prisma/
    └── schema.prisma      # Database schema
```

## Database Schema

Key models:

- **User** — Authentication, subscription, credits
- **Workspace** — Team organization
- **Project** — Business info, brand details
- **Campaign** — Marketing campaigns with goals
- **Media** — Uploaded assets
- **Generation** — AI-generated content
- **Subscription** — Billing and usage tracking
- **Integration** — Social platform connections

See [prisma/schema.prisma](prisma/schema.prisma) for full schema.

## Core Features

### 1. Authentication
- Email/password signup
- Google OAuth
- JWT sessions
- Protected pages

### 2. Campaign Wizard (6-Step Flow)
1. **Business Type** — Select industry
2. **Campaign Goal** — Sales, awareness, leads, traffic
3. **Target Audience** — Audience description
4. **Brand Tone** — Luxury, modern, energetic, etc.
5. **Platforms** — TikTok, Instagram, Facebook, YouTube Shorts
6. **Review & Generate** — Create campaign

### 3. AI Strategy Generation
- Analyzes uploaded media
- Generates marketing strategies
- Creates 5+ ad concepts
- Produces scripts, captions, CTAs

### 4. Media Management
- Drag-and-drop upload
- Cloud storage integration
- Organization and tagging
- Preview and editing

### 5. Content Generation
- Video generation (via Runway ML)
- Image creation
- Voiceover synthesis
- Social post templates

### 6. Dashboard & Analytics
- Campaign overview
- Performance tracking
- Asset library
- Export history

### 7. Subscriptions
- Starter, Pro, Agency plans
- AI credit system
- Usage tracking
- Stripe integration

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Environment variables set

### Installation

```bash
# Install dependencies
npm install

# Setup database
npx prisma db push

# Create environment file
cp .env.example .env.local

# Run development server
npm run dev
```

Visit `http://localhost:3000`

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# AI Services
OPENAI_API_KEY=...
RUNWAY_API_KEY=...

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Storage
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## API Endpoints

**Campaigns**
- `POST /api/campaigns` — Create campaign
- `GET /api/campaigns` — List campaigns
- `GET /api/campaigns/:id` — Get campaign details

**Generations**
- `POST /api/generations` — Queue content generation
- `GET /api/generations` — List generations
- `POST /api/webhooks/generation` — Generation callback

**Media**
- `POST /api/media` — Upload media
- `GET /api/media` — List media

**Workspaces**
- `POST /api/workspaces` — Create workspace
- `GET /api/workspaces` — List workspaces

**Exports**
- `POST /api/exports` — Create export
- `GET /api/exports/:id` — Download export

## Deployment

### Vercel (Recommended)

```bash
# Push to GitHub
git push origin main

# Vercel auto-deploys on push
# Configure environment variables in Vercel dashboard
```

### Railway / Render

1. Create PostgreSQL database
2. Deploy Next.js app
3. Set environment variables
4. Configure Stripe webhooks

## Development Roadmap

### Phase 1 (MVP - Current)
- ✅ Authentication
- ✅ Campaign wizard
- ✅ AI strategy generation
- ✅ Basic dashboard
- 🔄 Stripe integration
- 🔄 Media uploads

### Phase 2 (Q1)
- Social media integrations (Meta, TikTok)
- Advanced video generation
- Analytics dashboard
- Export formats (PDF, ZIP, JSON)

### Phase 3 (Q2)
- AI marketing agent
- Content calendar
- Collaboration features
- Usage analytics

### Phase 4 (Q3)
- Platform publishing (direct to TikTok, Instagram)
- Workflow automation
- Advanced analytics
- Enterprise features

## Contributing

This is a production SaaS application. Contributions should:

1. Follow existing code patterns
2. Include proper error handling
3. Add TypeScript types
4. Include unit tests
5. Update documentation

## License

Proprietary - NEXUS AI

## Support

For issues and feature requests, contact: support@nexus-ai.com

---

**Built with ❤️ for modern marketing teams**

## Developer Setup & Notes (Added by agent)

This repository has been extended with an MVP scaffolding for Supabase Auth (frontend), Prisma/Postgres models, AI adapter with mock fallback, and Stripe mock billing.

Quick local steps:

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and populate keys. For development you can leave `OPENAI_API_KEY` and `STRIPE_SECRET_KEY` empty — mock modes will be used.

3. Prisma (if using Postgres):

```bash
npx prisma generate
npx prisma db push
```

If you don't have Postgres, you can temporarily change `prisma/schema.prisma` datasource to `sqlite` and set `DATABASE_URL="file:./dev.db"`, then run the commands above.

4. Start the dev server:

```bash
npm run dev
```

APIs added by the agent (MVP-ready):
- `POST /api/generate` — Generate strategy and concepts (uses mock if `OPENAI_API_KEY` missing)
- `POST /api/uploads` — Upload base64 assets to `.storage/uploads` and save `Media` records
- `POST /api/campaigns`, `GET /api/campaigns`, `GET /api/campaigns/:id` — Campaign CRUD (basic)
- `GET /api/media` — List workspace media
- `POST /api/exports` — Create JSON export saved in `.storage/exports`

Notes:
- Frontend uses Supabase Auth (`src/lib/supabaseClient.ts` and `src/lib/auth-context.tsx`). Backend routes accept NextAuth sessions (existing) or Supabase bearer tokens.
- Stripe is in mock mode by default; set `STRIPE_MOCK=0` and provide `STRIPE_SECRET_KEY` to enable live mode.
- OpenAI calls are mocked when `OPENAI_API_KEY` is missing. Real integration is in `src/lib/ai/openai.ts`.

If you'd like, I can now:
- Run `npm install` and Prisma commands locally (if you enable terminal access), or
- Continue implementing richer UI features, exports (PDF), and Cloud storage adapters.
