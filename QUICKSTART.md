# Quick Start Guide

Get NEXUS AI running locally in 5 minutes.

## Prerequisites

- Node.js 18+ (https://nodejs.org)
- PostgreSQL 14+ (https://postgresql.org or Docker)
- Git (https://git-scm.com)

## Installation

### 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/yourusername/nexus-ai.git
cd nexus-ai

# Install dependencies
npm install
```

### 2. Set Up Database

#### Option A: Docker (Recommended)

```bash
# Start PostgreSQL container
docker run -d \
  --name nexus-db \
  -e POSTGRES_PASSWORD=nexus \
  -e POSTGRES_DB=nexus_ai \
  -p 5432:5432 \
  postgres:15

# Wait for container to start
sleep 3

# Database URL
DATABASE_URL="postgresql://postgres:nexus@localhost:5432/nexus_ai"
```

#### Option B: Local PostgreSQL

```bash
# Create database
createdb nexus_ai

# Get connection string
DATABASE_URL="postgresql://username:password@localhost:5432/nexus_ai"
```

### 3. Configure Environment

```bash
# Copy example file
cp .env.example .env.local

# Edit .env.local and add:
DATABASE_URL=postgresql://postgres:nexus@localhost:5432/nexus_ai
NEXTAUTH_SECRET=my-secret-key-$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000

# Add optional Google OAuth (or skip for email-only)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

### 4. Initialize Database

```bash
# Run migrations
npx prisma migrate dev

# Open Prisma Studio (optional)
npm run db:studio
```

### 5. Start Dev Server

```bash
npm run dev
```

Visit **http://localhost:3000** ✨

## First Steps

### Create Account

1. Click "Sign Up"
2. Enter email and password
3. Create workspace
4. Create project

### Test Campaign Wizard

1. Go to workspace
2. Create new project
3. Click "New Campaign"
4. Step through 6-step wizard
5. Generate campaign (uses mock data locally)

### View Campaign

1. Strategy generated (mock)
2. Ad concepts created (mock)
3. Dashboard shows campaign

## Development

### Code Style

```bash
# Run linter
npm run lint

# Format code
npm run format
```

### Type Checking

```bash
npm run type-check
```

### Database Commands

```bash
# Create migration
npx prisma migrate dev --name add_users

# Update database
npm run db:push

# Reset database (WARNING: deletes data)
npx prisma migrate reset
```

### Environment Variables

Add to `.env.local`:

```env
# AI Services
OPENAI_API_KEY=sk-...        # Optional, mocks used by default
RUNWAY_API_KEY=...            # Optional

# Storage
CLOUDINARY_API_KEY=...        # Optional, URLs mocked locally

# Payments
STRIPE_SECRET_KEY=...         # Optional, mocked locally
```

## Project Structure

```
src/
├── app/                  # Next.js pages and routes
│   ├── api/             # API endpoints
│   ├── auth/            # Auth pages
│   ├── dashboard/       # Main dashboard
│   └── campaign/        # Campaign pages
├── components/          # Reusable React components
│   └── CampaignWizard.tsx
├── lib/                 # Utilities and services
│   ├── auth.ts
│   ├── prisma.ts
│   ├── ai/              # AI integration
│   └── utils.ts
└── prisma/
    └── schema.prisma    # Database schema
```

## Common Tasks

### Add New Database Model

```bash
# Edit prisma/schema.prisma
model MyModel {
  id    String  @id @default(cuid())
  name  String
}

# Run migration
npx prisma migrate dev --name add_my_model
```

### Add New API Endpoint

```bash
# Create src/app/api/my-resource/route.ts
export async function GET(request) {
  // Handle GET
}

export async function POST(request) {
  // Handle POST
}
```

### Add New Page

```bash
# Create src/app/my-page/page.tsx
export default function MyPage() {
  return <div>My Page</div>
}
```

### Test Email Authentication

```
Email: test@example.com
Password: testpassword123
```

### Debug Database

```bash
# Open Prisma Studio
npm run db:studio

# View all data in browser at http://localhost:5555
```

## Troubleshooting

### Port 3000 Already in Use

```bash
npm run dev -- -p 3001
# Or kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database Connection Error

```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL

# Check PostgreSQL is running
brew services list  # macOS
systemctl status postgresql  # Linux
```

### Build Errors

```bash
# Clear cache
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### Authentication Not Working

```bash
# Verify NEXTAUTH_SECRET is set
echo $NEXTAUTH_SECRET

# Clear session cookies in browser DevTools
# Application → Cookies → Clear
```

## Next Steps

1. **Integrate OpenAI API** → Get API key, add to .env
2. **Connect Stripe** → Set up test account
3. **Add video generation** → Connect Runway ML
4. **Deploy to Vercel** → See DEPLOYMENT.md

## Resources

- **Next.js Docs** → https://nextjs.org/docs
- **Prisma Docs** → https://www.prisma.io/docs
- **Tailwind CSS** → https://tailwindcss.com/docs
- **NextAuth** → https://next-auth.js.org

## Support

- Issues: GitHub Issues
- Docs: README.md, ARCHITECTURE.md
- Email: support@nexus-ai.com

---

**You're all set! Start building. 🚀**
