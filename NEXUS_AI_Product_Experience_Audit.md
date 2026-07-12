# NEXUS AI — Current Product Experience Audit

**Scope:** Product experience, operating model, user journey, UX/UI, trust, Brand Brain, strategy, content, approvals, publishing, reporting, dashboard. **No** wallet/credits/billing/refund/subscription logic was changed or assessed beyond visible UX.
**Method:** Code inspection (repo `Kimi4567/Nexus-ai`, main `7108b72`) + live verification on `https://www.nexus-grow.com` while signed in as `raoufnaguib44@gmail.com` (UI in Arabic).
**Date:** 19 June 2026
**Rule applied:** Map the truth of the current product. No implementation orders, no PR roadmap. Strict, not polite.

Evidence tags used below: **[Confirmed]** seen in code *and/or* live UI · **[Inferred]** read from code, not visually confirmed · **[Verify]** needs checking · **[Risk-P]** product · **[Risk-U]** UX · **[Risk-T]** trust/hallucination.

---

## 1. Executive Summary

**Current product maturity (UX / operator journey only): ~45–55%.** The honest-publishing and connections layers are genuinely strong and near-premium. The journey *between* stages is fragmented, there are two parallel onboarding/strategy systems that contradict each other, and one screen (Analytics “PULSE”) actively violates the product’s own “never fake analytics/performance” rule.

**Strongest current areas**
- **Connections page** — best surface in the product. Honest, granular per-platform states (ready for manual / needs setup / not connected / connected-but-unconfirmed / not available yet). A model for everything else. **[Confirmed]**
- **Publishing safety model** — `publishMode` defaults to `MANUAL`; the publish cron auto-publishes *only* `AUTO` posts with a connected integration + token, enforced at DB-query and in-code layers. No screen fakes automatic publishing. **[Confirmed]**
- **Approval/publishing separation** — `approve` (DRAFT→APPROVED) is a distinct step from scheduling/publishing; a `PostStatusHistory` ledger records every transition. **[Confirmed]**
- **Marketing Operating Brief + dashboard intelligence** — built from real counts; KPIs like engagement appear *only* when real `analyticsData` exists. **[Confirmed]**
- **Brand Brain maturity honesty** — “45/100 مبكرة” with an expandable “why is it early at 100% completion?” evidence toggle and honest sub-labels (“العضوي جاهز · المدفوع تخطيط فقط · الذاكرة مبكرة”). **[Confirmed]**

**Weakest current areas**
- **Two competing front doors.** `/onboarding` (4 fields → auto-generates a strategy via the legacy `/api/strategy/generate`) runs in parallel to the real Brand Brain (`/brand`) + `/strategy` (run-full). They produce different artifacts and don’t reconcile. **[Confirmed]**
- **Analytics “PULSE”** presents GPT free-generation (competitors, trends, 3-month performance *forecasts*) under an “Analytics” banner with no “AI-generated / not real data” disclaimer. **[Confirmed] [Risk-T]**
- **Language integrity** — an Arabic user’s generated strategy renders hooks/CTAs in **English**; the Calendar page chrome is hardcoded **English** inside the Arabic app. **[Confirmed]**
- **Visual split-personality** — landing/auth/onboarding/brand-loading are **dark glassy**; the operator app (dashboard/brand/strategy/calendar/connections) is **calm white**. Two products visually. **[Confirmed]**

**Biggest trust risks**
1. Analytics PULSE “forecasts/competitors/trends” = speculative GPT output framed as analytics. **[Risk-T]**
2. Onboarding manufactures a “strategy” from 4 inputs and shows it as done — thin substance dressed as a real plan. **[Risk-T]**
3. English content inside an Arabic strategy undermines credibility for the core SME audience. **[Risk-T/U]**

**Biggest UX risks**
1. No single, enforced golden path — Brand Brain, Strategy, onboarding, and Campaigns are reachable independently and tell different stories about “what’s next.”
2. Sidebar “Create” group lists 7 destinations (Brand, Strategy, Campaigns, Content Hub, Calendar, Media, Templates) — overlapping and heavy for a non-technical SME.
3. Strategy is *configured* (form/modal) rather than *recommended by NEXUS*.

**Biggest missing journey links**
- Brand Brain → Strategy → Content is not a continuous, stateful flow; each is entered cold.
- Onboarding output is not visibly the same object as the `/strategy` page’s “draft.”
- No clear, single “one next best action” that persists across screens (the dashboard has one; other screens restate it differently or not at all).

---

## 2. Confirmed Current Journey Map

Signup/Login → First screen → Brand Brain → Strategy → Content → Calendar → Approval → Publishing → Reporting → Learning → Dashboard loop.

| Step | State | What the user sees | Action offered | What happens next | Trust risk | UX risk |
|---|---|---|---|---|---|---|
| **Signup** | Confirmed | Dark glassy register card; email verification screen with “after verifying you’ll: set up Brand Brain / create first campaign / publish” | Verify email | Email link → login | Low | Theme clash vs app; promises “publish” before connections exist |
| **Login** | Confirmed | Login → redirect target `?redirect` or `/dashboard` | — | Lands on `/dashboard` (not onboarding) for returning users | Low | New vs returning user paths diverge silently |
| **First-run** | Partial | `/onboarding` (separate dark wizard): welcome → brand (name/industry/audience/tone) → goal → generating → “done” with a strategy | “View strategy” / “Go to dashboard” | Creates workspace + brand + **auto-generates a strategy** | **High** — 4 fields → “strategy” | Parallel to real Brand Brain; user may never see `/brand` depth |
| **Brand Brain** `/brand` | Confirmed strong | Maturity 45/100 “مبكرة” + “why?” evidence; two-path Start (Assisted draft w/ credit costs, or Manual); honest sub-labels | Create draft / Start manually / Save All | Draft review before apply; Save All persists | Low | Lives *beside* onboarding; duplicate brand capture |
| **Strategy** `/strategy` | Partial | Read-only render of stored strategy: status “draft available”, organic plan (platforms, pillars, **English hooks/CTAs**), Paid plan “تخطيط فقط” + “no budget without explicit approval” | View campaigns / continue brand setup | Static display; generation happens elsewhere (dashboard modal / onboarding) | **Med** — English content; “needs data” vs brand 45/100 mismatch | Page doesn’t generate; entry point unclear |
| **Content** `/content-hub`, campaign content-plan | Confirmed | Campaign-grouped drafts; per-post platform; DRAFT default | Generate content plan / approve | SocialPost rows DRAFT→APPROVED→SCHEDULED→PUBLISHED | Low | Multiple content surfaces (Content Hub, campaign content-pack, content-hub per campaign) |
| **Calendar** `/calendar` | Confirmed | Month grid; legend Published/Scheduled/AI-Planned; honest empty state | Schedule from Content Hub | Approved posts overlay on grid | Low | **Page chrome hardcoded English** in Arabic app |
| **Approval** | Confirmed | `approve` = DRAFT→APPROVED only (separate from schedule); revert supported | Approve / request changes / revert | `approvedAt` set; hooks/angles extracted → learning | Low | “Request changes” teaching path exists in backend but UX surfacing is thin |
| **Publishing** | Confirmed strong | Manual default; “mark as published by me”; cron only AUTO+connected | Manual publish / schedule | Status history recorded; publishMode stays MANUAL | Low | Honest but multi-step; user must understand manual vs auto |
| **Paid Ads** | Confirmed | Planning-only pack; “ads will not launch and no budget will be spent without explicit approval”; “Mark as Launched by me” | Generate pack / mark launched | Self-reported launch; no spend | Low | Hidden from nav (beta) — good restraint |
| **Reporting** `/analytics` | **Conflicted** | Real cards (credits, generations, posts, campaigns) + **PULSE GPT tabs** (competitors/trends/forecast) | Run AI analysis | `/api/ai/generate` free-gen output | **High** — speculative output under “Analytics” | Mixes real and invented without labels |
| **Learning** | Confirmed (real) | BrainLearning proposals (winning hooks/angles, tone, pains, desires) from strategy/approved-content/performance; user-approved | Approve/reject proposals | Applied to Brand Brain on approval | Low | Learning evidence under-surfaced in main journey |
| **Dashboard loop** | Confirmed | Command-center: journey bar, platform-readiness strip, stats row, Operating Brief w/ next best action, campaigns, insights, alerts | One next best action | Routes to the recommended stage | Low | Dense; many sections compete with the single next action |

---

## 3. Screen Inventory

Core operator screens (nav-visible) and notable secondary screens. Hidden-beta routes exist on disk (`/studio`, `/sentinel`, `/vex`, `/paid-campaigns`) and are correctly removed from the sidebar.

| Route | Purpose | Main CTA | Secondary | Key cards/components | Empty state | Error state | Data source | Concern |
|---|---|---|---|---|---|---|---|---|
| `/` | Marketing landing | Get started / Sign in | Lang toggle | Hero, workflow, pricing | n/a | n/a | static | Dark theme vs app |
| `/auth/register` `/login` | Auth | Create / Sign in | Lang | Glass card, verify screen | n/a | inline error | Supabase | Dark theme; “publish” promise early |
| `/onboarding` | First-run wizard | Finish setup → strategy | Go dashboard | 4-field capture + generated strategy | n/a | fails silently → still “done” | `/api/workspaces`,`/api/brand`,`/api/strategy/generate` | **Parallel system; thin strategy** |
| `/dashboard` | Command center | Next best action | Run strategy modal | Journey bar, readiness strip, stats×4, Operating Brief, campaigns, insights, alerts | welcome + checklist for new users | per-card graceful | `/api/dashboard/*` | Dense |
| `/brand` | Brand Brain | Save All | Create draft / Score history | Maturity + “why”, two-path start, 8-step wizard, learned timeline | guided start | tolerant | `/api/brand`, scan/analyze | Strong; duplicate w/ onboarding |
| `/strategy` | Strategy display | View campaigns | Continue brand setup | Status cards, organic plan, paid “planning-only” | “needs data” | read-only | stored strategy | English content; not a generator |
| `/campaigns`,`/campaign/new` | Campaign list/create | New campaign | — | Campaign cards | — | — | `/api/campaigns` | Overlaps Content Hub |
| `/content-hub` | Draft library | Generate/approve | — | Campaign-grouped drafts | empty | — | `/api/campaigns/*` | Multiple content surfaces |
| `/calendar` | Schedule view | New Campaign + | List/timeline toggle | Month grid, legend, day panel | honest empty | — | scheduled SocialPosts | **English chrome** |
| `/connections` | Platform linking | Connect per platform | Review setup | Per-platform honest state rows | none-connected guidance | — | `/api/social/accounts` | **Best surface** |
| `/analytics` | Reporting | Run AI analysis | Tabs | Real stat cards + PULSE GPT tabs | skeletons | — | `/api/analytics/overview`+`insights` (real); `/api/ai/generate` (gen) | **Trust conflict** |
| `/billing` `/settings` `/media` `/templates` | Support | — | — | standard | — | — | — | Out of audit emphasis |
| `/campaigns/[id]/paid-launch` | Paid planning pack | Mark launched by me | Enter metrics | Planning brief, “no spend” notice | — | — | paid-pack | Honest |

---

## 4. Button / CTA Inventory (important controls)

| Label (as shown) | Location | What it actually does | Accurate? | Necessary? | Primary/secondary correct? | Confusion risk | Verdict |
|---|---|---|---|---|---|---|---|
| إنشاء أول استراتيجية / “View strategy” | Onboarding done | Shows legacy auto-generated strategy | Partially — it’s a thin draft | Questionable | Primary (over-weighted) | High — implies a real plan | **Needs study** |
| دع NEXUS يُجهّز مسودة / “Create draft · N credits” | `/brand` start | Scan/analyze → review-before-apply | Yes | Yes | Correct | Low | **Keep** |
| حفظ الكل / “Save All” | `/brand` | Only persistence step | Yes | Yes | Primary | Low | **Keep** |
| عرض الحملات / “View campaigns” | `/strategy` | Navigate to campaigns | Yes | Yes | Secondary | Low | **Keep** |
| New Campaign + | `/calendar` (English) | Create campaign | Yes | Yes | Primary | Med — English in Arabic UI | **Rename (localize)** |
| Run AI analysis (PULSE generate) | `/analytics` | `/api/ai/generate` speculative output | **No** — labeled as analytics | As-is, no | Primary | **High** | **Needs study / relabel** |
| “Mark as Launched by me” | paid-launch | Self-report launch, no spend | Yes | Yes | Primary | Low | **Keep** |
| منصات readiness “مراجعة الإعداد / ربط” | `/connections` | Connect / review per platform | Yes | Yes | Correct | Low | **Keep** |
| Manual publish / “mark as published” | content-plan post | SCHEDULED→PUBLISHED, manual | Yes | Yes | Correct | Low | **Keep** |

---

## 5. Card / Component Inventory (important cards)

| Card | Page | Purpose | Data shown | Real / inferred / empty | Supports a decision? | Verdict |
|---|---|---|---|---|---|---|
| Stats row (Credits, AI generations, Published posts, Campaigns) | Dashboard/Analytics | Surface real activity | Counts from ledger/DB | **Real** | Weakly (vanity) | **Keep, simplify** |
| Marketing Operating Brief + Next Best Action | Dashboard | Operator guidance | Loop coverage, brand memory %, execution, learning; engagement only if real | **Real** | **Yes** | **Keep** (make the hero) |
| Platform Readiness strip | Dashboard | Honest connection status | Connected/needs-setup | **Real** | Yes | **Keep** |
| “What NEXUS Learned” line | Dashboard | Learning summary | From BrainLearning | **Real** (sparse) | Partially | **Keep, expand evidence** |
| AI Insights / Alerts | Dashboard | Rule-based nudges | Real DB states | **Real** | Yes | **Keep** |
| Maturity + “why early?” | Brand Brain | Honest readiness | completeness/memoryDepth/learningActivity | **Real, evidenced** | Yes | **Keep — exemplary** |
| Organic plan (pillars/hooks/CTAs) | Strategy | Show plan | Stored strategy | **Real but English content** | Partially | **Needs study (language)** |
| Paid plan “تخطيط فقط” | Strategy | Honest paid posture | static notice | **Honest** | Yes | **Keep** |
| PULSE Competitors/Trends/Forecast | Analytics | “Intelligence” | GPT free-gen | **Inferred, unlabeled** | Misleadingly | **Needs study / relabel** |
| Per-platform connection rows | Connections | Honest states | Integration status | **Real** | Yes | **Keep — exemplary** |
| Calendar legend (Published/Scheduled/AI-Planned) | Calendar | Status truth | Real post status | **Real** | Yes | **Keep, localize** |

---

## 6. Brand Brain Truth Audit

**What exists [Confirmed].** A genuinely deep Brand Brain at `/brand`: maturity score (`brandMaturity.ts` → breakdown completeness/memoryDepth/learningActivity), readiness gate (`brandReadiness.ts`: 5 required fields = 70% weight, 5 recommended = 30%), an 8-step manual wizard, an assisted “Create draft” path (website scan + content analysis with credit costs shown), a review-before-apply step, a learned-memory timeline (`BrainTimeline`), and BrainLearning proposals.

**What is strong.** Maturity is **evidence-based and honest** — “45/100 مبكرة” even at 100% field completion, with an expandable “why?” explanation. Sub-labels separate posture cleanly: “العضوي جاهز · المدفوع تخطيط فقط · الذاكرة مبكرة”. Assisted drafts never auto-apply; nothing saves without “Save All”.

**Known vs assumed vs missing vs learned.** Partially separated. The readiness model distinguishes **known** (filled required fields) from **missing** (gate lists them), and the learning timeline shows **learned** items. The assisted-draft review labels suggestions by basis (extracted/observed/inferred) and confidence — good. **Gap:** there is no single consolidated, always-visible “What NEXUS knows / assumes / is missing / has learned” panel on the Brand Brain home; the four states are spread across maturity, gate, review, and timeline. **[Risk-U]**

**Readiness labels.** Each has evidence. No fake/overconfident labels observed. **[Confirmed]**

**Learning evidence.** Real: proposals carry field, source trigger (strategy/approved-content/performance), and require user approval. **Gap:** date/source context is present in data but lightly surfaced in UI. **[Verify depth]**

**Is it the heart of the product?** *Almost.* It is rich enough to be the heart, but the **parallel `/onboarding` brand capture** (4 fields) undercuts it — a new user can complete onboarding and get a “strategy” without ever experiencing Brand Brain’s depth, making Brand Brain feel like an optional settings page rather than the core. **[Risk-P]**

**Arabic copy.** Neutral MSA, professional, Middle-East friendly. One inconsistency: credits rendered as **“كردت”** (transliteration) on the Brand Brain start panel vs **“رصيد”** in the sidebar.

---

## 7. Strategy Truth Audit

**Entry point — unclear/duplicated [Confirmed].** Three ways a strategy comes into being: (a) `/onboarding` auto-calls legacy `/api/strategy/generate` (goal/timeframe/platform/budget); (b) dashboard `RunFullStrategyModal` → `/api/strategy/run-full`; (c) `/strategy` page only **renders** a stored strategy (explicit code comment: it does not generate and “invents no budgets, KPIs, results, percentages, timelines”). These are not unified.

**Setup.** It feels **user-configured through a form/modal**, not **recommended by NEXUS**. The product wants an operator that *proposes* the strategy from the Brand Brain; today the user picks type/duration/language/goal. **[Risk-P]**

**Generation.** Loading and failure states exist; onboarding “fails silently and still proceeds to done,” which can present an empty/weak strategy as success. **[Risk-T]**

**Output.** On `/strategy`: organic monthly plan (platforms, content pillars, hooks, CTAs) + paid plan. **Two defects:** (1) hooks/CTAs render in **English** for an Arabic user; (2) top cards say brand memory **“يحتاج بيانات” (needs data)** while `/brand` shows **45/100** — inconsistent truth between screens. **[Risk-T/U]**

**Operator Brief quality.** The dashboard Marketing Operating Brief is the closest thing to an operator brief and is solid (real signals + one next action). The `/strategy` page itself is more of a plan viewer than an operator brief. **[Confirmed]**

**30-day plan quality.** Present in concept (organic monthly plan + content pillars) but reads template-generic in the sampled output (e.g., “Struggling with marketing chaos? Let AI take the reins!”). Not clearly tied to *this* brand’s specifics in the visible draft. **[Verify on a fresh run-full]**

**KPI honesty.** Strong where it counts: `/strategy` explicitly avoids inventing KPIs; paid plan is planning-only with explicit “no spend without approval.” **[Confirmed]**

**Next best action clarity.** Good on dashboard, weak on `/strategy` (the “Next steps” list is generic).

---

## 8. Content / Creative / Calendar Audit

**Connection to strategy [Inferred/Confirmed].** Content-plan generation reads campaign + brand (audience, offer) and connected platforms; creative briefs pull Brand Brain pain points/desires. So content *is* brand-connected. Whether each post is explicitly tagged with **funnel stage + business goal** is **not** evident in the post schema (it has `cta`, `platform`, `approved`, status — but no explicit funnelStage/goal field). **[Verify]** — purpose-per-post is partial.

**Draft/approval states [Confirmed].** Clean status machine: `SocialPostStatus` DRAFT → APPROVED → SCHEDULED → PUBLISHED (+ FAILED), with `PostStatusHistory`. Drafts are clearly drafts; approval is required and separate.

**Creative purpose.** Creative briefs exist (asset/concept modes) and are Brand-Brain-guided rather than random. Visuals are guided by brand inputs. **[Confirmed]**

**Calendar usefulness [Confirmed].** Useful as an operational view: month grid, honest empty state (“you have 2 campaigns with content — approved content not scheduled yet; schedule from Content Hub”), legend distinguishing Published / Scheduled / AI-Planned, and manual-vs-auto distinction in code (`postStatus`, `postVisibility`). **Defect:** page chrome is hardcoded **English** in the Arabic app (“Content Calendar”, “New Campaign +”, “Select a day”, legend).

**Manual/auto status clarity.** Honest in both calendar and publishing. **[Confirmed]**

**Surface sprawl [Risk-U].** Content lives across `/content-hub`, `/campaigns/[id]/content-hub`, `/campaigns/[id]/content-pack`, and the calendar — overlapping mental models for an SME.

---

## 9. Approval / Publishing / Paid Ads Audit

**Approval separation [Confirmed, strong].** `approve` mode = DRAFT→APPROVED only and never schedules; a legacy `approve_and_schedule` exists but is explicit. Approval also extracts winning hooks/angles into the learning loop. Reverts supported.

**Manual publishing truth [Confirmed, strong].** Default `publishMode = MANUAL`. Manual publish sets `manuallyPublishedAt` and keeps `publishMode = MANUAL`, recording a USER-actor status-history note. No screen claims a platform published it when the user did.

**Auto publishing readiness [Confirmed, strong].** The publish cron auto-publishes **only** posts with `publishMode = AUTO` **and** a connected integration with a token — enforced at both the DB query and a defensive in-code filter. Legacy/manual posts are never auto-published even when scheduled and past due.

**Paid ads planning-only truth [Confirmed, strong].** Paid pack page: “Planning only — ads will not launch and no budget will be spent without explicit approval.” Budget/reach are framed as planning; audience targeting is generated as a plan; the user self-reports “Mark as Launched by me.” Paid surfaces (`/paid-campaigns`, `/vex`) are hidden from nav. The `/strategy` paid card mirrors this (“تخطيط فقط”, “لن يتم صرف اي ميزانية … بدون موافقة صريحة”).

**Misleading labels.** None found in approval/publishing/paid. The only paid-adjacent caution: paid-pack copy mentions “estimatedReach”/“budgetInsights” — acceptable as *planning* but should always sit under a visible “estimate/hypothesis” label. **[Verify label prominence]**

This cluster is the product’s trust backbone and is in good shape.

---

## 10. Reporting / Learning Audit

**Real vs fake [Confirmed + Risk-T].**
- **Real:** `/api/analytics/overview` and `/api/analytics/insights` are scrupulously real (“Returns real workspace analytics”; “Never fabricates metrics — every insight maps to an actual DB state”). Dashboard stat cards, published-post counts, generation counts = real.
- **Fake/speculative:** The Analytics **PULSE** tabs — Competitors, Trends, Content, **Forecast** — call `/api/ai/generate` with prompts like *“forecast performance for the next 3 months”* and *“who their real competitors are, strengths and weaknesses.”* This is GPT free-generation grounded only on brand text, **presented under an “Analytics” banner with a “GPT-4o · نشط” badge and no disclaimer**. For a product whose mission is “never fake … analytics, performance,” this is the single clearest violation. **[Risk-T, high]**

**Manual results entry [Confirmed].** Paid-launch page accepts manual metrics (impressions/reach/clicks/spend/conversions/roas) — honest user-entered data path exists.

**Analytics connection honesty.** When no platform is connected, real metrics correctly read zero/empty and the page points to `/connections`. The PULSE tabs, however, will still produce confident “analysis” with zero connected data. **[Risk-T]**

**Learning memory [Confirmed, real].** BrainLearning proposals from three real triggers (strategy generated, content approved, post performance via the analytics cron + `brain-learning`), user-approved before applying. Learnable fields are specific (winning hooks/angles, tone, audience pains/desires, unique advantages, strategic notes). This is real learning, not display text.

**Evidence/source.** Proposals carry field + trigger; performance writeback is automated. **Gap:** source/date context is under-surfaced in the UI relative to what the data holds. **[Verify UI]**

---

## 11. UX / UI Design Audit

**Visual hierarchy.** Operator app (dashboard/brand/strategy/calendar/connections) is calm, white, Apple-adjacent, with restrained cards and soft borders (`Sidebar.tsx` is explicitly “calm SaaS navigation”). Good baseline. The dashboard is **dense** — journey bar + readiness strip + welcome + checklist + stats×4 + Operating Brief + campaigns + insights + alerts compete with the single “next best action.”

**Card density.** High on dashboard and analytics; medium elsewhere. Several dashboard sections are gated for new vs established users (good), but established users still see a lot.

**Typography / color / spacing.** Consistent within the white app; brand gradient (purple→orange) used tastefully in the logo and accents.

**Premium feel.** Present in connections, brand brain, calendar empty states. **Broken** by: (a) the dark landing/auth/onboarding/brand-loading screens — a visual split-personality between the “funnel” and the “app”; (b) emoji-heavy onboarding/strategy copy (🎉, ⚡, 🧠) which reads more “growth-hack” than “calm operator.”

**Arabic/English parity [Confirmed gaps].** Dashboard/brand/strategy/connections localize well. **Calendar chrome is hardcoded English.** Generated strategy content renders **English** in an Arabic UI. Transliteration creep: “بوستات” (calendar) vs proper “منشورات” (dashboard); “كردت” vs “رصيد”.

**Mobile.** Sidebar has collapse + mobile-close affordances; not deeply verified live this pass. **[Verify mobile]**

**Visual noise / decorative cards.** The dashboard “Marketing Journey Bar” and some stat cards are closer to decoration than decision-support; the Analytics hero (“PULSE … GPT-4o · نشط”) is more theatrical than operator-calm. **[Risk-U]**

---

## 12. Copy & Trust Language Audit (EN + AR)

**Good — keep**
- AR: “لن يتم صرف اي ميزانية إعلانية بدون موافقة صريحة.” (No ad budget spent without explicit approval.) — exemplary.
- AR: “فيسبوك — جاهز للنشر اليدوي.” (Facebook — ready for manual publishing.) — honest, specific.
- AR: “لينكدإن — متصل، لكن صلاحية النشر غير مؤكدة بعد.” (Connected, but publishing permission not yet confirmed.) — premium-level honesty.
- AR: “يُنشئ NEXUS مسودة لمراجعتك” + “لا شيء يُحفظ تلقائياً.” (NEXUS creates a draft for your review; nothing saved automatically.)
- EN: analytics route comment-level discipline (“Never fabricates metrics”) is reflected in real cards.

**Too vague**
- `/strategy` “الخطوات التالية” (Next steps) list is generic; not tied to this brand’s state.
- Onboarding “done” subtitle stands in for a strategy title when generation is thin.

**Overclaiming / misleading**
- Analytics PULSE: “توقعات AI” / 3-month performance “forecast,” “المنافسون” competitor intelligence — framed as analytics without an “AI-generated, not measured” caveat. **[Risk-T]**
- Register: “after verifying you’ll … publish content to social media” — sets an automation expectation before any platform is connected. **[Risk-T mild]**
- Onboarding presenting a 4-field output as a “strategy.” **[Risk-T]**

**Too technical**
- “كردت” / “بوستات” transliterations; “Brand Brain” left in English inside Arabic copy (acceptable as a product name, but mixed with “ذاكرة العلامة” elsewhere — pick one).

**Not Middle-East-friendly Arabic**
- No Egyptian-dialect leakage found; Arabic is neutral MSA. The only issues are transliteration (“كردت”, “بوستات”) and English content inside Arabic plans — both reduce the MSA-professional impression.

**Missing language**
- No “AI-generated / not based on your real data” caveat on PULSE tabs.
- No consistent “not connected yet” caveat carried into Analytics (it’s strong on Connections, absent on PULSE).
- “Planning-only / approval-required” is excellent in paid + strategy but should be echoed wherever paid/auto appears.

---

## 13. Current Product Gaps by Severity

**P0 — blocks honest/beta use**

| Issue | Evidence | User impact | Product impact | Needs code verification? |
|---|---|---|---|---|
| Analytics PULSE presents GPT free-gen (competitors/trends/**forecasts**) as “Analytics,” no disclaimer | `analytics/page.tsx` prompts → `/api/ai/generate`; live “GPT-4o · نشط” badge | Users trust invented competitor/forecast data | Directly violates “never fake analytics/performance” | No (confirmed) |
| Onboarding manufactures a “strategy” from 4 fields and can present empty/weak output as “done” (fails silently) | `onboarding/page.tsx` → `/api/strategy/generate`; “fail silently … still proceed to done” | Thin plan framed as a real strategy; erodes trust at minute one | Undermines Brand Brain as the heart | No (confirmed) |

**P1 — major UX/trust issue**

| Issue | Evidence | Impact | Code-verify? |
|---|---|---|---|
| Two parallel front doors (onboarding vs Brand Brain) + two strategy generators (`/api/strategy/generate` vs `/run-full`) that don’t reconcile | routes + nav | Fragmented, contradictory journey; duplicate data capture | No |
| Generated strategy content in **English** for an Arabic user | live `/strategy` | Credibility loss with core SME audience | Verify run-full language handling |
| Cross-screen truth mismatch: `/strategy` “needs data” vs `/brand` “45/100” | live | Confuses “where am I?” | No |
| Strategy is form-configured, not NEXUS-recommended | modal/form | Feels like a generator, not an operator | No |

**P2 — important improvement**

| Issue | Evidence | Impact |
|---|---|---|
| Calendar chrome hardcoded English | live `/calendar` | Arabic parity break |
| Visual split-personality (dark funnel vs white app) | landing/auth/onboarding/brand-loading | Premium feel broken at the seams |
| Content surface sprawl (Content Hub vs campaign content-pack vs per-campaign hub) | routes | Cognitive load |
| Brand Brain lacks one consolidated known/assumed/missing/learned panel | `/brand` | Harder to see “what NEXUS knows” at a glance |
| Per-post purpose incomplete (no explicit funnelStage/businessGoal field) | `schema.prisma` SocialPost | Content reads as posts, not operations | Verify |

**P3 — polish**

| Issue | Evidence | Impact |
|---|---|---|
| Transliteration creep (“كردت”, “بوستات”) | brand/calendar | MSA polish |
| Emoji-heavy growth-hack copy in onboarding/strategy | live | Tone vs “calm operator” |
| Dashboard density vs single next action | dashboard | Focus dilution |
| “Brand Brain” vs “ذاكرة العلامة” naming inconsistency | various | Minor confusion |

---

## 14. What We Should Study Next

Based on current truth, study in this order (study, not build):

1. **The front-door & strategy unification question first.** The biggest structural truth-debt is two onboarding paths and two strategy generators that disagree. Before any polish, study how `/onboarding` + `/api/strategy/generate` should relate to Brand Brain + `/api/strategy/run-full` — because every downstream screen (strategy, content, dashboard “next action”) inherits whichever artifact won. This is the keystone.
2. **Analytics PULSE truth boundary** (tie for urgency on trust grounds). Study what “reporting” should mean when no platforms are connected: where real-data reporting ends and where “AI advisory” begins, and how each must be labeled. This is the clearest violation of the product’s own rule and is self-contained.
3. **Then** the Strategy stage as a *recommendation* rather than a form, and language integrity (Arabic output, calendar localization), which both depend on outcome #1.

Brand Brain, connections, approval, and publishing are already close to the target model and should be studied **last** (preserve, don’t disturb).

---

## 15. Appendix

**Files inspected (code)**
- Navigation/shell: `src/components/Sidebar.tsx`, `src/components/AppShell.tsx`
- Auth/first-run: `src/app/auth/register/page.tsx`, `src/app/auth/login/page.tsx`, `src/app/start/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/api/auth/welcome/route.ts`
- Dashboard: `src/app/dashboard/page.tsx`, `src/app/api/dashboard/intelligence/route.ts`, `src/lib/marketing-intelligence.ts`
- Brand Brain: `src/app/brand/page.tsx`, `src/lib/brandReadiness.ts`, `src/lib/brandMaturity.ts`, `src/components/brain/BrainTimeline.tsx`
- Strategy: `src/app/strategy/page.tsx`, `src/app/api/strategy/generate/route.ts`, `src/app/api/strategy/run-full/route.ts` (referenced)
- Content/calendar: `src/app/content-hub/page.tsx`, `src/app/calendar/page.tsx`, `src/app/api/campaigns/[id]/generate-content-plan/route.ts`, `src/app/api/campaigns/[id]/creative-brief/route.ts`, `prisma/schema.prisma` (SocialPost, SocialPostStatus, PublishMode, PostStatusHistory)
- Approvals/publishing: `src/app/api/campaigns/[id]/approve-content-plan/route.ts`, `src/app/api/campaigns/[id]/content-plan/[postId]/manual-publish/route.ts`, `src/app/api/cron/publish/route.ts`
- Paid: `src/app/api/campaigns/[id]/paid-pack/route.ts`, `src/app/api/campaigns/[id]/paid-pack/generate/route.ts`, `src/app/campaigns/[id]/paid-launch/page.tsx`
- Reporting/learning: `src/app/analytics/page.tsx`, `src/app/api/analytics/overview/route.ts`, `src/app/api/analytics/insights/route.ts`, `src/app/api/brain/learn/route.ts`, `src/app/api/brain/proposals/route.ts`
- Connections: `src/app/connections/page.tsx`

**Routes inspected (live, signed in, Arabic UI):** `/dashboard`, `/brand`, `/strategy`, `/calendar`, `/connections`, `/analytics`.

**Production pages verified by screenshot:** dashboard (200, LIVE), brand (maturity + two-path start; dark loading screen), strategy (organic plan with English hooks + paid planning-only), calendar (English chrome + honest empty state), connections (honest per-platform states), analytics (real cards + PULSE GPT tabs).

**Checks run:** none that mutate state. No code, branches, commits, or deploys. No wallet/billing/credit/subscription logic touched. Credits display read 132 throughout (display only).

**Could not verify this pass (flagged [Verify]):**
- Mobile/RTL layout behavior live.
- Exact substance/quality of a fresh `run-full` strategy (only a pre-existing draft was visible).
- Whether per-post records carry funnel-stage/business-goal beyond `cta`/`platform`/status.
- Depth of date/source context surfaced for learned items in the UI.
- Prominence of “estimate/hypothesis” labeling on paid-pack reach/budget.
- Snapchat/Google/WhatsApp `available` flags beyond the “غير متاح بعد” live labels.

**Note on parallel systems:** `/onboarding` writes brand via `/api/brand` and a strategy via `/api/strategy/generate`; the operator app’s Strategy stage uses `/api/strategy/run-full`. Reconciling these is the keystone finding (§13 P0/P1, §14 #1).
