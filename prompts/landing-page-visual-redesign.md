# Landing Page Visual Redesign Prompt

---

## Your Role

You are a world-class SaaS landing page designer and frontend engineer.
You have full creative freedom over **visuals, layout, and graphics only**.
The copy (text) is final and must not change — not a single word, not a comma.

---

## The Product

**NEXUS AI** — An AI marketing operating system for businesses in the Arab world and globally.
It's not a writing tool. It's a full marketing department: 4 AI agents that work together to build strategy, generate content, review campaigns, and auto-publish to social media.

**Brand feel:** Premium. Intelligent. Action-oriented. Feels like a venture-backed B2B SaaS — not a toy.
**Audience:** Arabic and English-speaking business owners, marketers, small teams.
**Current stack:** Next.js 14, Tailwind CSS, Framer Motion. Must stay React/Next.js compatible.
**Current color palette:** Dark background #060718, primary purple #8B5CF6, cyan #22D3EE, emerald #10B981

---

## What You MUST NOT Change

- Every single word of copy (Arabic and English both)
- All href links and routing logic
- All functionality (language switcher, mobile menu, FAQ accordion, etc.)
- The bilingual structure (ar/en conditional rendering)
- All Lucide icon imports already in the file
- The existing `useTranslation` and `useI18n` hooks
- Any existing API calls or state management

---

## What You Have Full Creative Freedom Over

**1. Hero Section**
- The particle background system — redesign or replace it completely. Maybe a 3D grid, flowing mesh, animated SVG geometry, orbital rings, or a cinematic abstract scene. Go bold.
- The hero visual/illustration — right now it's just pipeline cards floating in space. Design something more dramatic: a split-screen dashboard mockup, an animated workflow visualization, a 3D device frame showing the product, or a data visualization art piece.
- Background gradients and atmospheric lighting — make it feel like a command center or mission control.
- The pipeline step cards (Brand Brain → Strategy → Content Hub → Approved → Published) — redesign as a more visual, premium timeline or process flow. Could be orbital, could be a vertical timeline, could be a cinematic progress track.

**2. Brand Brain Section**
- The 6 feature grid (Brand Identity, Voice & Tone, Target Audience, etc.) — redesign as something premium. Glassmorphism cards, hexagonal tiles, or an interactive brain visualization. Each card should feel like a data node.
- The section background — atmospheric, with a subtle neural network or data visualization motif.

**3. Agents Section (NEXUS · NEX · VEX · SENTINEL)**
- Each agent has: codename, role title, description, and 4 skill tags.
- Right now they're in cards. Redesign as something more cinematic — agent dossiers, command interface cards, or profile cards with distinctive visual identities.
- Each agent has its color: NEXUS=#8B5CF6, NEX=#22D3EE, VEX=#F97316, SENTINEL=#10B981. Use these as identity colors.
- Consider adding decorative SVG avatars/icons per agent — geometric, abstract, or minimal line-art robot/AI representations.

**4. How It Works / Pipeline Section**
- A 5-step visual journey: (1) Fill Brand Brain → (2) Run AI Strategy → (3) Content Hub generates 30 posts → (4) Approve All → (5) Auto-publish
- Right now it's a basic section. Redesign as an animated, visual process diagram — could be a horizontal scrolling timeline, a connected node graph, or a cinematic sequence of screens.

**5. Social Mockups (Instagram · LinkedIn · TikTok)**
- These exist in the hero area. Make them look like actual premium device mockups — with subtle phone frames, shadows, or floating 3D-perspective cards.
- The mockups currently show placeholder content. Keep the placeholder feel but make the frames/containers look production-quality.

**6. Pricing Section**
- 3 plans: Free ($0), Pro ($79/mo — featured), Business ($199/mo)
- Redesign the cards with premium visual differentiation. The Pro plan should visually dominate — use a spotlight, glow border, or elevated treatment.
- Consider an annual/monthly toggle as a visual element (even if not functional yet).

**7. Tech Bar**
- Currently: GPT-4o · Flux 1.1 Pro · Meta API · LinkedIn API · TikTok API · Arabic · English · Stripe · Supabase
- Make it feel more premium — could be a scrolling ticker, icon badges, or a floating trust strip.

**8. General Visual Upgrades**
- Section transitions — add subtle decorative dividers, gradient fades, or geometric separators between sections.
- Typography hierarchy — feel free to adjust font weights, letter-spacing, and sizing for visual drama (but keep all text content intact).
- Scroll animations — enhance with more sophisticated reveal patterns (staggered, parallax, blur-in, etc.).
- Cursor/interactive effects — consider a custom cursor, magnetic button effects, or hover states that feel premium.
- Color usage — you can introduce new accent colors or gradients as long as they feel cohesive with the existing palette.

---

## The Exact Copy (Do Not Change)

### Navbar
- Logo: **NEXUS** [AI badge]
- Nav links: Brand Brain · How It Works · Agents · Pricing
- Actions: [Language toggle: English/العربية] · Sign In · **Start Free**

### Hero Badge
- EN: `YOUR COMPLETE AI MARKETING DEPARTMENT`
- AR: `قسم التسويق الذكي بالكامل`

### Hero H1
- EN:
  > From blank brief
  > **to a month of content**
  > in one session.

- AR:
  > من brief فارغ
  > **لشهر محتوى**
  > في جلسة واحدة.

### Hero Subtitle
- EN: *NEXUS remembers your brand, builds a full AI strategy, generates 30 publish-ready posts, and auto-publishes to Facebook, LinkedIn, and TikTok.*
- AR: *NEXUS يتذكر علامتك التجارية، يبني استراتيجية كاملة بالـ AI، يولد 30 بوست جاهزة للنشر، وينشر أوتوماتيك على Facebook وLinkedIn وTikTok.*

### Hero CTAs
- Primary: `Start Free — No credit card` / `ابدأ مجاناً — لا بطاقة ائتمان`
- Secondary: `See how it works` / `شاهد كيف يعمل`

### Trust signals (below CTAs)
- ✓ 20 free AI credits / 20 رصيد AI مجاناً
- ✓ Cancel anytime / إلغاء في أي وقت
- ✓ Arabic & English / عربي وإنجليزي

### Pipeline Steps
1. Brand Brain — Ready / جاهز
2. Strategy — Generated / مولّدة
3. Content Hub — 30 posts / 30 بوست
4. Approved — Done / تم
5. Published — Live / مباشر

### Tech Bar
`GPT-4o · Flux 1.1 Pro · Meta API · LinkedIn API · TikTok API · Arabic · English · Stripe · Supabase`

### Brand Brain Section
- Section label: `THE REAL MEMORY OF YOUR BRAND` / `الذاكرة الحقيقية لعلامتك`
- H2:
  - EN: **Brand Brain — the AI that knows your brand**
  - AR: **Brand Brain — الـ AI الذي يعرف علامتك**
- Subtitle:
  - EN: *Most AI tools forget what you told them yesterday. Brand Brain builds a permanent memory injected into every agent, every post, every campaign — and evolves with every result.*
  - AR: *أغلب أدوات الـ AI تنسى ما أخبرتها به بالأمس. Brand Brain يبني ذاكرة دائمة تُحقن في كل وكيل، كل بوست، وكل حملة — وتتطور مع كل نتيجة.*

- 6 Brain attributes:
  1. 🏷️ Brand Identity — Name, tagline, category
  2. 🎙️ Voice & Tone — How your brand speaks
  3. 🎯 Target Audience — Who you're talking to
  4. ⚔️ Competitors — Who you're beating
  5. 💡 Unique Value — Why you win
  6. 📣 Winning Hooks — What converts

### Agents Section
- Section label: `THE TEAM` / `الفريق`
- H2:
  - EN: **4 AI agents. One mission: grow your brand.**
  - AR: **4 وكلاء AI. مهمة واحدة: تنمية علامتك.**

**NEXUS** — Chief Strategist (color: #8B5CF6)
> Analyzes your brand, market, and competitors — then builds a full marketing strategy with GPT-4o. Positioning, hooks, CTAs, and a content calendar in seconds.
> Skills: Brand positioning · Competitor analysis · Hooks & CTAs · Content calendar

**NEX** — Content Writer (color: #22D3EE)
> Writes every post in your brand voice — no generic templates. Platform-aware, audience-aware, with a strong hook on every caption.
> Skills: Instagram · LinkedIn · TikTok · Brand voice injection · Arabic & English · One-click AI Rewrite

**VEX** — Paid Campaigns Director (color: #F97316)
> Generates a complete paid campaign brief — audience targeting, copy variants, UTM tracking, and platform-specific launch guides. Not ideas — an execution plan.
> Skills: Audience targeting · Ad copy variants · UTM tracking · ROI analysis

**SENTINEL** — Market Monitor (color: #10B981)
> Monitors the competitive landscape against your specific brand positioning. Reviews every campaign before launch and delivers a readiness report.
> Skills: Competitor analysis · Campaign review · Readiness report · Market alerts

### Pricing Section
- Section label: `PRICING` / `الأسعار`
- H2:
  - EN: **Start free. Scale when ready.**
  - AR: **ابدأ مجاناً. تطور عندما تكون جاهزاً.**

**Free — $0**
> Explore the full power. No credit card needed.
- 20 AI credits to explore
- 1 workspace · 1 full campaign
- Strategy + content + images
- Brand Brain (read & write)
CTA: `Start Free`

**Pro — $79/mo** ⭐ Most popular
> For serious businesses and small teams.
- 300 AI credits — renews monthly
- 3 workspaces · 20 campaigns / month
- 100 scheduled posts / month
- Auto-publish: Meta · LinkedIn · TikTok
- Full Brand Brain + all agents
- A/B Testing + AI Rewrite
- Analytics + ROI Dashboard
- PDF + DOCX export
CTA: `Start Pro — $79/mo`

**Business — $199/mo**
> For agencies and larger teams.
- 1,000 AI credits — renews monthly
- 10 workspaces · 60 campaigns / mo
- Unlimited posts · Multi-account publishing
- 3 team seats
- White-label exports (your logo)
- Advanced analytics · Priority support
CTA: `Start Business — $199/mo`

### FAQ
1. **How does the AI know my brand?**
   > Before anything, you fill in Brand Brain — your identity, voice, audience, competitors, and goals. This data is injected into every AI agent before generating any content. The more you use the platform, the smarter Brand Brain gets from successful campaigns.

2. **Does the AI publish automatically without my approval?**
   > Never. Every post goes through the Approval Center first. You see each post in its actual platform preview before it goes live. Approve All schedules everything, but nothing publishes without your review.

3. **How long does a full campaign take?**
   > A full strategy takes ~30 seconds. A 30-post content plan takes ~2 minutes. Reviewing and approving everything: 10-15 minutes. From idea to 30 scheduled posts in one session.

4. **Does it support Arabic?**
   > Yes. Full Arabic interface with RTL support. Agents generate content in Arabic or English based on your preference — or both in the same campaign.

5. **Do I need to connect my social accounts immediately?**
   > No. You can generate strategy, content, and export or execute manually from day one. Connecting Facebook/LinkedIn/TikTok is optional and you activate it when ready.

6. **What makes NEXUS different from ChatGPT or any random AI writing tool?**
   > ChatGPT writes for you — and forgets what you said yesterday. NEXUS builds a real memory for your brand, manages the full pipeline from strategy to publish, and learns from every campaign. You don't write prompts — you run a marketing department.

### Footer
- Logo: NEXUS AI
- Tagline: AI-powered marketing intelligence for serious businesses.
- Links: Privacy Policy · Terms of Service · Contact
- © 2025 NEXUS AI. All rights reserved.

---

## Visual Inspiration References

Aim for the visual quality of: **Linear.app**, **Vercel.com**, **Resend.com**, **Loom.com**, **Clerk.com**

The page should feel like it belongs in a premium SaaS company's portfolio — not a generic AI tool landing page.

Dark, atmospheric, premium. Generous whitespace. Typography-led with strategic use of color.

---

## Output Requirements

1. A single, complete `page.tsx` file for Next.js 14 App Router
2. Must use Tailwind CSS classes (utility-first)
3. Framer Motion for animations (already installed)
4. Lucide React for icons (already installed)
5. All existing React logic preserved (bilingual ar/en, FAQ accordion, mobile nav, etc.)
6. Zero TypeScript errors
7. Mobile-responsive (must work on 375px screens)

Produce your absolute best work. This is a real product competing in the AI SaaS market.
