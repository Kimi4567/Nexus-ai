# NEXUS AI — Ordr شاملة لـ Claude / المطور

> **تاريخ:** 2026-05-29
> **المشروع:** `~/Desktop/Nexus-ai`
> **الهدف:** دمج النسخة الجديدة (v2) مع المشروع الأصلي وتحويلها لمنصة تسويق AI متكاملة

---

## 🧠 الفكرة المركزية (الـ North Star)

NEXUS AI **وكالة تسويق بالذكاء الاصطناعي** — تعمل **كل حاجة تخص التسويق** نيابة عن المستخدم.

مش مجرد أدوات. مش مجرد chatbot. ده **بديل حقيقي لشركات التسويق البشرية**.

### الفلسفة:
- **يدرك سيكولوجية الإنسان** → يصمم تجربة تأسر العميل
- **كل بيكسل مصمم بعناية** → سهولة + إبهار + اعتماد + عودة
- **4 وكلاء AI** → كل واحد متخصص، متفاعل، ذكي جداً، مش مجرد محادثة
- **3D + Animation + Space Theme** → يوحي بالتطور والمستقبل

---

## 📦 المشروع الأصلي (اللي موجود في `src/app/`)

| الملف/المجلد | الوصف |
|-------------|-------|
| `src/app/page.tsx` | Landing Page (original Nexus design) |
| `src/app/dashboard/page.tsx` | Dashboard (old design) |
| `src/app/auth/login/page.tsx` | Login (NextAuth + Supabase) |
| `src/app/auth/register/page.tsx` | Register |
| `src/app/api/` | **كل الـ Backend APIs** — هذا الأهم |
| `src/lib/auth-context.tsx` | Auth Context (NextAuth + Supabase) |
| `src/lib/supabase/` | Supabase clients |
| `prisma/schema.prisma` | Database schema |
| `src/components/ui/` | UI components (Navbar, HeroSection, CrewSection, etc.) |
| `src/components/ui/NeuralCanvas.tsx` | Particle animation |
| `.env` | Environment variables |

### الـ APIs الموجودة (ما تمسحهمش!):
- `/api/agency/clients/[id]/report`
- `/api/ai/generate`
- `/api/ai/rewrite`
- `/api/campaigns`
- `/api/stripe/*`
- `/api/webhooks/*`
- `/api/workspace/*`
- وأكتر...

### الـ Tech Stack الأصلي:
- **Next.js 14** (App Router)
- **NextAuth.js** (authentication)
- **Supabase** (database + auth + storage)
- **Prisma** (ORM)
- **Stripe** (payments)
- **Tailwind CSS**

---

## 🆕 النسخة الجديدة (اللي "كيمي" بناها في `app/`)

كيمي بنا **موقع كامل جديد** في `app/` (root level) — ده يعني Next.js هيستخدمه ويهمل `src/app/`.

| الملف | الوصف |
|-------|-------|
| `app/page.tsx` | Landing Page جديدة (Hero + Crew + Pricing + FAQ + CTA) |
| `app/login/page.tsx` | Login (localStorage auth — مش Supabase) |
| `app/register/page.tsx` | Register (localStorage) |
| `app/dashboard/page.tsx` | Dashboard بسيط |
| `app/dashboard/layout.tsx` | Sidebar + Topbar |
| `app/studio/page.tsx` | **NEX** — استوديو الفيديو |
| `app/vex/page.tsx` | **VEX** — مدير الإعلانات |
| `app/analytics/page.tsx` | **PULSE** — التحليلات |
| `app/sentinel/page.tsx` | **Sentinel** — المراقبة |
| `app/campaigns/page.tsx` | قائمة الحملات |
| `app/campaigns/new/page.tsx` | معالج إنشاء حملة |
| `app/settings/page.tsx` | الإعدادات |
| `app/components/Navbar.tsx` | Navbar جديد |
| `app/components/Sidebar.tsx` | Sidebar |
| `app/components/NeuralCanvas.tsx` | Particle animation محسّنة |
| `app/components/ProtectedRoute.tsx` | Auth guard |
| `app/hooks/useAuth.tsx` | Auth Context (localStorage) |
| `app/services/openai.ts` | OpenAI integration |

---

## ⚠️ المشكلة الحالية

المشروع ليه **structure مكرر**:
```
Nexus-ai/
├── app/           ← كيمي بنا ده (جديد)
├── src/app/       ← الأصلي (فيه APIs + DB + Auth)
```

**Next.js هيستخدم `app/` ويهمل `src/app/`!** → Backend APIs كلها هتتنازل.

---

## 🎯 المطلوب (الأوردر)

### الخطوة 1: إعادة تنظيم المشروع

**القرار:** نستخدم **`src/app/`** الأساسي (عشان نحتفظ بالـ Backend APIs) وننقل محتوى `app/` لـ `src/app/`.

```bash
# الأوامر اللي هتنفذها:

# 1. احتفظ بنسخة احتياطية من app/
cp -r app app_backup_v2

# 2. انقل كل صفحات v2 لـ src/app/ (مع تعديل المسارات)
# هننقل الصفحات دي:
# - app/studio/page.tsx → src/app/studio/page.tsx
# - app/vex/page.tsx → src/app/vex/page.tsx
# - app/analytics/page.tsx → src/app/analytics/page.tsx
# - app/sentinel/page.tsx → src/app/sentinel/page.tsx
# - app/campaigns/ → src/app/campaigns/
# - app/settings/page.tsx → src/app/settings/page.tsx

# 3. انقل الـ components
cp -r app/components/* src/components/

# 4. انقل الـ hooks
mkdir -p src/hooks
cp app/hooks/* src/hooks/

# 5. انقل services
mkdir -p src/services
cp app/services/* src/services/

# 6. احذف app/ بعد التأكد
rm -rf app/
```

**ملاحظة:** لما تنقل الملفات، لازم تعدل الـ `import` paths:
- `from '../hooks/useAuth'` → `from '@/hooks/useAuth'`
- `from '../services/openai'` → `from '@/services/openai'`
- `from '../components/...'` → `from '@/components/...'`

---

### الخطوة 2: دمج الـ Auth Systems

الأصلي بيستخدم **NextAuth + Supabase**.
الجديد بيستخدم **localStorage**.

**المطلوب:** استخدم NextAuth + Supabase من الأصلي. احذف `useAuth.tsx` الجديد واستخدم `src/lib/auth-context.tsx` الموجود.

لكن لازم تضيف `ProtectedRoute` logic للـ Dashboard pages:
```tsx
// في كل صفحة محمية (studio, vex, analytics, sentinel, dashboard)
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProtectedPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    if (!loading && !user) router.push('/auth/login')
  }, [user, loading, router])
  
  if (loading) return <LoadingScreen />
  if (!user) return null
  
  return <ActualContent />
}
```

---

### الخطوة 3: تصميم الـ Landing Page (الصفحة الرئيسية)

**اللي نحتفظ بيه من `src/app/page.tsx` الأصلي:**
- NeuralCanvas (الخلفية المتحركة)
- Navbar المُصلح (بمسافات صح)

**اللي نضيفه من `app/page.tsx` الجديد:**
- Hero Section مع الـ Orbit Animation
- Crew Section (4 agents)
- Pricing Section
- FAQ Section
- CTA Section
- Footer

**ملاحظة تصميم:**
- `html { direction: rtl; }`
- Font: `Noto Sans Arabic`
- Colors: Amber (`#f59e0b`) + Cyan (`#06b6d4`) + Dark (`#020204`)
- Glassmorphism cards
- Shimmer effect على العناوين
- Smooth animations (framer-motion)

---

### الخطوة 4: بناء الـ 4 Agents (الأهم!)

كل agent لازم يكون **متخصص، تفاعلي، ذكي جداً** — مش مجرد واجهة.

---

#### 🤖 Agent 1: **NEX** — منتج الفيديو التسويقي

**الوظيفة:** ينتج فيديوهات تسويقية كاملة بالـ AI.

**القدرات:**
1. ياخد وصف المنتج/الخدمة من المستخدم
2. يكتب سكريبت فيديو (hook + body + CTA) بالـ OpenAI
3. يولد صور/ثامبنيل بالـ DALL-E 3 (Replicate)
4. يولد voiceover بالـ ElevenLabs (أو TTS)
5. يجمّع الفيديو (Runway / Replicate video generation)
6. يطلع فيديو جاهز للنشر

**الـ UI (Studio Page):**
- Form: اسم المنتج + الوصف + الأسلوب (تسويقي/تعليمي/ترفيهي/عاطفي)
- اختيار: voice (رجالي/نسائي/شبابي) + music (حيوي/هادئ/درامي/بدون)
- slider: المدة (15-120 ثانية)
- زر "إنشاء الفيديو" → يطلع progress bar
- بعد الانتهاء: preview + download + نسخ السكريبت
- قائمة الفيديوهات السابقة

**الـ Backend API المطلوب:**
```
POST /api/agents/nex/generate
Body: { productName, description, style, voice, music, duration }
Response: { script, videoUrl, thumbnailUrl, status }
```

---

#### 🤖 Agent 2: **VEX** — مدير الإعلانات

**الوظيفة:** يُنشئ ويدير حملات إعلانية عبر كل المنصات.

**القدرات:**
1. يكتب نسخ إعلانية (ad copy) بالـ AI
2. يصمم creative (صورة + نص + headline)
3. يحدد الجمهور المستهدف (targeting)
4. يحدد الميزانية والـ bidding strategy
5. يراقب أداء الحملة (CTR, CPC, ROI)
6. يعطي recommendations (زود/قلّل الميزانية، غيّر الـ creative)

**الـ UI (VEX Page):**
- قائمة الحملات النشطة (Facebook, Instagram, TikTok, Google)
- كل حملة: status (active/paused) + budget + spent + CTR + ROI
- زر "حملة جديدة" → wizard:
  - اختيار المنصة
  - اسم المنتج + الوصف
  - الهدف (مبيعات/وعي/تفاعل/قيادة)
  - الميزانية اليومية
  - المدة
- AI يولد: 3 نسخ إعلانية + targeting suggestions
- بعد الموافقة: VEX "يُطلق" الحملة (يتصل بـ Facebook/Google APIs)
- Dashboard: charts for performance

**الـ Backend API المطلوب:**
```
POST /api/agents/vex/create-campaign
POST /api/agents/vex/generate-copy
POST /api/agents/vex/launch (connect to Facebook/Google APIs)
GET /api/agents/vex/campaigns
GET /api/agents/vex/performance/:id
```

---

#### 🤖 Agent 3: **PULSE** — المحلل الذكي

**الوظيفة:** يحلل كل البيانات ويطلع insights وتوصيات.

**القدرات:**
1. يربط بـ Google Analytics, Facebook Insights, TikTok Analytics
2. يجمع data من كل المنصات
3. يحلل: views, clicks, CTR, conversion rate, ROI, CPA
4. يقارن أداء الحملات
5. يكتشف trends وأنماط
6. يعطي توصيات بالـ AI:
   - "حملة X أداءها نازل — غيّر الـ creative"
   - "TikTok CTR أعلى — زوّد الميزانية هناك"
   - "أفضل وقت للنشر هو 8-10 مساءً"

**الـ UI (Analytics Page):**
- Charts (Recharts): Line chart (views/clicks over time), Bar chart (revenue), Pie chart (platform distribution)
- Stats cards: Views, CTR, Revenue, Users
- Date range picker: 7 days / 30 days / 90 days
- "تحليل ذكي بالـ AI" زر → يولد report بالـ GPT-4
- Insights panel: توصيات ملونة (green=good, yellow=warning, red=urgent)
- Export report (PDF)

**الـ Backend API المطلوب:**
```
GET /api/agents/pulse/data?range=7|30|90
POST /api/agents/pulse/analyze (AI insight)
GET /api/agents/pulse/recommendations
```

---

#### 🤖 Agent 4: **Sentinel** — الحارس / المراقب

**الوظيفة:** يراقب السوق، المنافسين، والأداء — وينبه قبل ما تحصل المشكلة.

**القدرات:**
1. **مراقبة المنافسين:**
   - يتابع منافسين محددين
   - يراقب حملاتهم الإعلانية (AdSpy / Facebook Ad Library)
   - يلاحظ تغييرات في pricing, messaging, positioning
   - يبلغك: "المنافس X زاد إنفاقه 40% — ليه؟"

2. **مراقبة الأداء:**
   - يشوف لو CTR نازل بشكل غير طبيعي
   - يشوف لو ميزانية الحملة وصلت 80%
   - يشوف لو فيه error في أي integration

3. **اكتشاف الفرص:**
   - "زيادة الإنفاق على TikTok بنسبة 15% هيزود ROI"
   - "هذا الموضوع trending — عمل حملة عليه"

4. **التنبيهات (Alerts):**
   - Real-time notifications
   - Color-coded: green (good), yellow (warning), red (urgent)
   - Push notifications (لاحقاً)

**الـ UI (Sentinel Page):**
- Status cards: الحالة العامة + الميزانية + الأداء + المنافسين
- Competitor monitor: قائمة المنافسين + threat level (low/medium/high)
- Alerts feed: كل التنبيهات مع الوقت
- AI recommendations: "فرصة جديدة: ..."

**الـ Backend API المطلوب:**
```
GET /api/agents/sentinel/status
GET /api/agents/sentinel/competitors
GET /api/agents/sentinel/alerts
POST /api/agents/sentinel/add-competitor
```

---

### الخطوة 5: الـ Dashboard

الـ Dashboard لازم يكون **المركز العصبي**:
- Overview لكل الـ Agents
- Stats summary (فيديوهات, حملات, views, إيرادات)
- آخر النشاطات (Activity feed)
- Quick actions: "إنشاء فيديو" / "إطلاق حملة" / "مراقبة المنافسين"
- Agent status: NEX (شغال/فاضي), VEX (نشط/معلق), PULSE (محلّل), Sentinel (يراقب)

---

### الخطوة 6: التصميم (Design Direction)

**الـ Mood:** Space, Future, Advanced, Intelligent, Premium

**الألوان:**
- Background: `#020204` (deep space black)
- Primary: `#f59e0b` (amber/gold)
- Secondary: `#06b6d4` (cyan)
- Accent: `#8b5cf6` (violet)
- Success: `#10b981` (emerald)
- Danger: `#f43f5e` (rose)
- Text primary: `#f8fafc`
- Text secondary: `#94a3b8`
- Text muted: `#64748b`

**التأثيرات:**
- Glassmorphism: `rgba(255,255,255,0.03)` + `backdrop-filter: blur(20px)`
- Shimmer text animation
- Float animation للـ cards
- Particle network background (NeuralCanvas)
- Orbit animation للـ agents
- Smooth page transitions (framer-motion)
- Glow effects على الـ CTAs

**الـ Typography:**
- `Noto Sans Arabic` (Google Fonts)
- Weights: 400, 500, 600, 700, 800, 900
- RTL fully

**Responsive:**
- Mobile-first
- Sidebar يختفي على mobile → bottom nav
- Cards stack على mobile
- Touch-friendly buttons

---

### الخطوة 7: الـ Backend APIs

**لازم تربط الـ APIs الحقيقية:**

| API | الاستخدام |
|-----|----------|
| **OpenAI GPT-4o-mini** | كتابة scripts, ad copy, insights, analysis |
| **Runway ML** | توليد فيديو |
| **Replicate** | توليد صور + فيديو |
| **Supabase** | Database + Auth + Storage |
| **Stripe** | Payments + Subscriptions |
| **Facebook Marketing API** | إطلاق/إدارة حملات Facebook/Instagram |
| **Google Ads API** | إدارة حملات Google |
| **ElevenLabs** | Voiceover |

**لاحظ:** الفيسبوك و جوجل APIs معقدة ومحتاجة review. في البداية، استخدم **demo mode** مع AI-generated content.

---

### الخطوة 8: الإعدادات (Settings Page)

- **Profile:** الاسم، البريد، الصورة
- **Plan:** الاشتراك الحالي + upgrade
- **API Keys:** إضافة OpenAI key, Runway key, etc.
- **Brand Settings:** tone, audience, positioning
- **Notifications:** email/push preferences
- **Language:** Arabic / English

---

## 🗂️ هيكل الملفات النهائي (المطلوب)

```
Nexus-ai/
├── src/
│   ├── app/
│   │   ├── page.tsx                    ← Landing Page (merged v2)
│   │   ├── layout.tsx                  ← RTL + Fonts + Providers
│   │   ├── globals.css                 ← CSS كامل
│   │   ├── auth/
│   │   │   ├── login/page.tsx          ← (original NextAuth)
│   │   │   └── register/page.tsx       ← (original)
│   │   ├── dashboard/
│   │   │   ├── page.tsx                ← Dashboard overview
│   │   │   └── layout.tsx              ← Sidebar + Topbar
│   │   ├── studio/
│   │   │   └── page.tsx                ← NEX Agent
│   │   ├── vex/
│   │   │   └── page.tsx                ← VEX Agent
│   │   ├── analytics/
│   │   │   └── page.tsx                ← PULSE Agent
│   │   ├── sentinel/
│   │   │   └── page.tsx                ← Sentinel Agent
│   │   ├── campaigns/
│   │   │   ├── page.tsx                ← Campaigns list
│   │   │   └── new/page.tsx            ← Campaign wizard
│   │   ├── settings/
│   │   │   └── page.tsx                ← Settings
│   │   └── api/                        ← ALL original APIs preserved!
│   │       ├── agency/
│   │       ├── ai/
│   │       ├── campaigns/
│   │       ├── stripe/
│   │       └── ...
│   ├── components/
│   │   ├── ui/                         ← Original UI components
│   │   ├── Navbar.tsx                  ← Merged Navbar
│   │   ├── Sidebar.tsx                 ← Dashboard sidebar
│   │   ├── Topbar.tsx                  ← Dashboard topbar
│   │   ├── NeuralCanvas.tsx            ← Particle background
│   │   ├── StatCard.tsx                ← Stats cards
│   │   └── ProtectedRoute.tsx          ← Auth guard
│   ├── hooks/
│   │   └── useAuth.tsx                 ← (use original from lib/)
│   ├── lib/
│   │   ├── auth-context.tsx            ← Original NextAuth context
│   │   ├── supabase/                   ← Supabase clients
│   │   └── prisma.ts                   ← Prisma client
│   ├── services/
│   │   └── openai.ts                   ← OpenAI integration
│   └── styles/
│       └── ...
├── prisma/
│   └── schema.prisma                   ← Database schema
├── public/
│   └── ...
├── .env                                ← Environment variables
├── tailwind.config.ts                  ← Updated config
└── next.config.js                      ← Next.js config
```

---

## ✅ Checklist للتنفيذ

- [ ] 1. نقل `app/` → `src/app/` مع تعديل الـ import paths
- [ ] 2. حذف `app/` بعد التأكد
- [ ] 3. دمج Navbar: استخدام `src/components/ui/Navbar.tsx` المُصلح
- [ ] 4. دمج Landing Page: Hero + Orbit + Crew + Pricing + FAQ + CTA
- [ ] 5. بناء NEX Studio page (video generation)
- [ ] 6. بناء VEX Manager page (ad campaigns)
- [ ] 7. بناء PULSE Analytics page (charts + AI insights)
- [ ] 8. بناء Sentinel page (monitoring + alerts)
- [ ] 9. دمج Dashboard: overview + stats + activity + quick actions
- [ ] 10. إعداد Campaigns + Campaign Wizard
- [ ] 11. إعداد Settings page
- [ ] 12. حماية الصفحات بـ ProtectedRoute (NextAuth)
- [ ] 13. ربط OpenAI API (GPT-4o-mini)
- [ ] 14. إضافة Recharts للـ Analytics
- [ ] 15. تصميم responsive (mobile)
- [ ] 16. إضافة animations (framer-motion)
- [ ] 17. إضافة NeuralCanvas background
- [ ] 18. بناء Backend APIs للـ Agents
- [ ] 19. Test build: `npm run build`
- [ ] 20. Deploy: `git push origin main`
- [ ] 21. Verify on Vercel

---

## 🔑 API Keys (موجودة في Vercel Environment Variables)

```
NEXTAUTH_SECRET=
OPENAI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=
RUNWAY_API_KEY=
REPLICATE_API_TOKEN=
REPLICATE_VIDEO_MODEL_VERSION=
DATABASE_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

**ملاحظة:** ما تكتبش الـ keys في الملفات العامة! استخدم `.env.local` للـ development.

---

## 📞 بعد ما تخلص

1. نفّذ: `npm run build`
2. لو نجح: `git add . && git commit -m "feat: complete v2 merge with 4 AI agents" && git push origin main`
3. شوف الـ Deploy على Vercel
4. ابعت screenshot للـ Landing Page والـ Dashboard
5. نختبر كل agent ونصلح أي bug

---

**الرسالة الأخيرة للمطور:**

> ده مش مجرد موقع. ده **وكالة تسويق كاملة بالذكاء الاصطناعي**. كل agent لازم يبقى "شخص" حقيقي — عنده شخصية، وظيفة واضحة، وقدرة على "الفهم" والـ "العمل". التصميم لازم يوحي بالمستقبل والفضاء. العميل لما يدخل الموقع لازم يحس إنه داخل "مركبة فضاء" للتسويق.
>
> **ابدأ بالخطوة 1 (إعادة التنظيم) وابعتلي update بعد كل خطوة.**
