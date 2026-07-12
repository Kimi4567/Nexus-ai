# PX-D1 Discovery Audit — NEXUS Product Design System & Layout

**Type:** Discovery / report only. No code, branch, commit, or deploy. No wallet/billing/credits/analytics-PULSE/publishing/paid/connections/generation logic touched.
**Method:** Live inspection on `https://www.nexus-grow.com` (signed in, Arabic UI) + design-token inspection in code (`globals.css`, `layout.tsx`, `Sidebar.tsx`). Post PX-1 / PX-2A / PX-2B.1 / PX-2B.2.
**Date:** 19 June 2026
**Lens:** Should feel like a premium, calm, Apple-level AI Marketing Operator for SME owners — not a crowded SaaS dashboard or a random AI tool.

Severity tags: **P0** trust/design blocker · **P1** major clarity/premium issue · **P2** important improvement · **P3** polish.

---

## 1. Executive Summary

**Overall design maturity (design-system + layout): ~60%.** The foundations are good — a real light "operator" token system, honest copy after the PX work, and several genuinely premium surfaces — but the product still reads as a **capable SaaS app, not yet an Apple-calm operator cockpit**, because of three things: split-personality theming remnants, density, and accent/CTA inconsistency.

**Strongest surfaces**
- **Connections** — calm, honest, scannable; the per-platform status rows are the cleanest pattern in the product.
- **Settings** — clean, well-structured, professional white layout with a sensible secondary nav.
- **Brand Memory surface (`/brand`, PX-2A)** — the four truth cards + readiness panel are a real "operating memory" pattern and now the strongest content design in the app.
- **Strategy status card (`/strategy`, PX-2B.1)** — capability-specific, honest, no bare "Ready".

**Weakest surfaces**
- **Dashboard** — dense command center with *competing* numbers and ~8 stacked sections; the single "next best action" has to fight for attention.
- **Content Hub** — campaign cards render **dark** against the white app (split-personality), and the page overlaps Campaigns.
- **Analytics "PULSE"** — visually theatrical ("GPT-4o · نشط" badge, AI-engine framing) in a way that over-promises; design amplifies the known trust risk.
- **Auth / first paint** — the root `<body>` is still **dark navy `#0A0E27`** and auth pages are dark/glassy, so the very first impression contradicts the white operator app.

**Biggest design risks**
1. **Split personality (P1):** white operator app sitting on a dark navy root, with dark remnants in auth, `/brand` loading+error states (`#06071A`), and Content Hub campaign cards. Premium feel breaks at the seams.
2. **Two primary accents, used inconsistently (P1):** violet `#5E5CE6` is "the" primary almost everywhere, but Brand Brain is themed **amber `#D97706`**, and primary buttons vary (violet on Content Hub, black on Campaigns, amber-gradient "Save All" on Brand). No single "this is the primary action" signal.
3. **Density / competing metrics (P1):** the dashboard shows a "64 progress" number, a Brand Memory stage, stat cards, a journey bar, and a readiness strip simultaneously — more cockpit dials than an SME can read.

**Biggest UX-clarity risks**
- "Where am I / what should I do next" is answered well on `/brand` and `/connections`, **weakly on the dashboard** (too many candidates) and on **Content Hub vs Campaigns** (overlapping purpose).
- Amber is overloaded — it's both the **Brand accent** and the **warning** color, so "is this a brand thing or a caution?" is ambiguous.

---

## 2. Current Design Language

**What it feels like today:** a clean, modern, **light SaaS** product with a violet/amber accent system, soft white cards (`--nx-surface #FFFFFF`, borders `rgba(15,23,42,0.08)`), and restrained shadows. At its best (Connections, Settings, Brand Memory) it is calm and credible. At its worst (dashboard density, dark remnants, PULSE theatrics) it reads as "another AI SaaS."

**White/operator vs dark/glassy remnants (the core tension):**
- **Root is dark:** `layout.tsx` sets `<body className="… text-white" style={{ backgroundColor: '#0A0E27' }}>`. The light operator theme is painted *on top* by each page's white shell. So first paint / any unwrapped state can flash dark.
- **Auth (`/auth/login`, `/auth/register`):** dark `bg-bg-base` + `glass-panel` — the first thing a new user sees is the *opposite* of the app.
- **`/brand` loading + error states:** dark navy `#06071A` (then the loaded page is white) — a jarring flash on the product's heart page.
- **Content Hub campaign cards:** dark grey cards with white text inside an otherwise white page.
- Legacy dark tokens still defined (`--nx-card-dark`, `--nx-border-dark`, `--nx-text-on-dark`).

**Premium strengths:** consistent border/radius language, calm spacing on the good pages, honest copy (post-PX), tasteful violet→orange logo gradient, real type ramp.
**Premium weaknesses:** the dark remnants; two competing accents; inconsistent primary-button treatment; a few emojis still in product chrome (e.g., a "📧" badge in Settings, emoji icons in learnable-field metadata); decorative gradient top-bars on many cards that add color without meaning.

---

## 3. Page-by-Page Design Audit

| Page | Purpose (clear in 5s?) | Layout | Primary action | Card density | Visual hierarchy | Copy clarity | Verdict |
|---|---|---|---|---|---|---|---|
| **/dashboard** | Command center / "what now" — *purpose clear but diluted* | Dashboard grid, ~8 stacked sections | "Next best action" (competes) | **High** | Weak — many peers compete | Good (honest, MSA) | **Redesign later** (prioritize, collapse) |
| **/brand** | Brand memory / "what NEXUS knows" — clear | Header + Brand Memory cards + wizard | "Save All" (amber) / "Improve Brand Memory" (violet) | Medium-high | Good after PX-2A | Strong | **Keep, simplify** (amber theme, wizard length) |
| **/strategy** | Turn brand → plan — clear | 2 status cards + organic/paid plan | "Create your first strategy" | Medium | Good | Strong (but English hooks in AR output) | **Keep, simplify** |
| **/onboarding** | First-run brand starter — clear (PX-1) | Centered single-column wizard | "ابدأ تعريف نشاطك" | Low (calm) | Strong | Strong | **Keep** (best-structured flow) |
| **/content-hub** | Review generated content — *overlaps Campaigns* | Header + campaign cards | "خطة جديدة" (violet) | Low | OK | OK | **Needs study** (dark cards; merge with Campaigns?) |
| **/campaigns** | Manage campaigns — *overlaps Content Hub* | Stats×3 + filters + list | "حملة جديدة" (black) | Medium | OK | OK | **Needs study** (consolidate; button color) |
| **/calendar** | Schedule view — clear | Stats×3 + month grid + day panel | "New Campaign +" | Medium | OK | Mixed (English chrome remnants) | **Keep, simplify** (localize chrome) |
| **/connections** | Link platforms — clear | Single-column honest rows | per-platform connect | Low | Strong | Strong | **Keep — model surface** |
| **/analytics (PULSE)** | Reporting — *over-promises* | Stats×4 + AI-engine tabs | "Run AI analysis" | High | Theatrical | Risky (GPT framing) | **Needs study** (de-theatricalize; trust) |
| **/settings** | Account — clear | 2-col (nav + content) | Save profile | Low | Strong | Good | **Keep** |
| **Auth/start** | Sign in/up — clear | Dark glass card | Sign in / Get started | Low | OK | OK | **Redesign later** (dark→white) |

---

## 4. Card Inventory (major cards)

| Card | Page | Type | Purpose | Decision value | Verdict |
|---|---|---|---|---|---|
| Marketing Journey Bar (5 steps) | Dashboard | Status | Show stage progress | Low (decorative) | **Simplify/remove** |
| Platform Readiness strip | Dashboard | Truth | Honest connect status | High | **Keep** |
| Stats row (Credits / AI gen / Posts / Campaigns) | Dashboard, Campaigns, Calendar, Analytics | Status | Real counts | Low–med (vanity) | **Simplify** (1 row max, not on every page) |
| Marketing Operating Brief (64 + signals + next action) | Dashboard | Decision | Operator guidance | High | **Keep, declutter** (drop the 64 number) |
| Welcome banner + Onboarding checklist | Dashboard | Action | New-user guidance | Med (new users) | **Keep** (gated correctly) |
| AI Insights / Alerts | Dashboard | Warning/Action | Rule-based nudges | Med | **Keep** |
| Campaigns list card | Dashboard, Campaigns | Action | Open a campaign | High | **Keep** |
| Brand Memory: Known / Missing / Confirm / Learned | /brand | Truth/Evidence | Operating memory | High | **Keep — strongest** |
| Current readiness panel | /brand, /strategy | Truth | Capability status | High | **Keep** |
| Maturity header + "Why Early at 100%?" | /brand | Truth | Honest depth | High | **Keep** |
| Two-path start (Assisted/Manual) | /brand | Action | Setup choice | High | **Keep** |
| Strategy status + Brand Memory cards | /strategy | Status/Truth | Stage + capability | High | **Keep** |
| Organic/Paid plan cards | /strategy | Evidence | The plan | Med (English hooks) | **Keep, fix language** |
| Content Hub campaign cards (dark) | /content-hub | Action | Open campaign content | Med | **Simplify** (de-dark) |
| Per-platform connection rows | /connections | Truth | Honest state | High | **Keep — model** |
| Calendar month grid + legend | /calendar | Status | Schedule + states | High | **Keep, localize** |
| PULSE AI-engine tabs (Competitors/Trends/Forecast) | /analytics | Decorative/Risk | GPT free-gen | Negative (misleading) | **Needs study** |
| Gradient top-bars (on many cards) | Multiple | Decorative | None | None | **Remove** (color without meaning) |

---

## 5. Button / CTA Inventory (important)

| Button | Page | Type | Actual result | Truthful? | Verdict |
|---|---|---|---|---|---|
| Next best action (dynamic) | Dashboard | Primary | Routes to recommended stage | Yes | **Keep** (make the only primary) |
| إنشاء أول استراتيجية / خطة محتوى جديدة | Dashboard header | Primary ×2 | New strategy / content | Yes | **Demote one** (two primaries) |
| تحسين ذاكرة العلامة التجارية | /brand Memory | Primary (violet) | Opens editor | Yes | **Keep** |
| حفظ الكل / Save All | /brand header | Primary (amber gradient) | Persists brand | Yes | **Keep, recolor** (amber ≠ app primary) |
| Create draft · N credits | /brand start | Primary | Scan/analyze | Yes | **Keep** |
| Create your first strategy | /strategy | Primary | New strategy | Yes | **Keep** |
| خطة جديدة | /content-hub | Primary (violet) | New plan | Yes | **Keep** |
| حملة جديدة | /campaigns | Primary (**black**) | New campaign | Yes | **Recolor** (match app primary) |
| New Campaign + | /calendar | Primary (English) | New campaign | Yes | **Rename (localize)** |
| Run AI analysis | /analytics PULSE | Primary | GPT free-gen output | **No** (labeled analytics) | **Needs study** |
| per-platform connect / review | /connections | Secondary | Connect/review | Yes | **Keep** |
| Mark as published / Approve | content-plan | Primary | Manual publish / approve | Yes | **Keep** |

**Pattern problem:** the *primary* button has at least **three different visual treatments** across pages (violet solid, black solid, amber gradient). There should be exactly one "primary" look, and **one primary per screen** (dashboard header has two).

---

## 6. Typography Audit

**Fonts (from `layout.tsx`):** Inter (EN body/UI), Space Grotesk (display/headings), JetBrains Mono (mono/ids), **Noto Sans Arabic** (AR). Default stack: `'Inter', 'Noto Sans Arabic', system-ui`.

**Arabic/English balance:** generally good — Noto Sans Arabic is a neutral, professional, Middle-East-appropriate face and reads well at the sizes used; Arabic headings have proper weight. RTL mirroring is correct across every page seen.

**Problems**
- **Helper text is often too faint** (`--nx-text-4 #9CA3AF` on white) — borderline for accessibility on small captions.
- **Heading scale is inconsistent** page-to-page (e.g., `/brand` "Brand Brain" `text-xl` vs `/strategy` and `/dashboard` larger display headers); no single type ramp enforced.
- **Mono font (JetBrains)** appears in product chrome (e.g., user-ID, some labels) where it reads "techy," slightly against the calm-operator goal.
- A few **transliteration/awkward** remnants elsewhere were fixed in PX work (`كردت→رصيد` in onboarding + /brand); remaining: minor spelling drift "قيد التطور" (/brand) vs "قيد التطوّر" (others).

**For later study:** define one type ramp (display / H1 / H2 / body / caption) and apply it everywhere; lift caption color one step (`text-3` not `text-4`); decide whether mono belongs anywhere user-facing.

---

## 7. Color Audit

| Color | Token / value | Meaning today | Issues |
|---|---|---|---|
| Primary violet | `#5E5CE6` (--nx-violet) | Primary actions, active nav, links | Good — but not consistently *the* primary (see amber/black buttons) |
| Brand amber/orange | `#D97706` / `#f59e0b` | Brand Brain theme + "Save All" + warnings | **Overloaded** — same hue means "brand" AND "caution" |
| Success green | `#10B981 / #059669` | Ready/connected/good | Mostly real success — good |
| Warning amber | `#EAB308 / #F59E0B` | Watch/planning | Collides visually with brand amber |
| Error red | `#F43F5E / #EF4444` | Error/risk | Now used honestly (PX-2B.2 removed red "Early") |
| Neutral gray | `#111827…#9CA3AF` (4 levels) | Text/borders | Good ramp; faintest level overused for captions |
| Gradients | violet→orange (logo), `#111827→#5E5CE6`, `#5E5CE6→#2563EB` | Logo + buttons + decorative top-bars | Decorative card top-bars = **color without meaning** |
| Dark/glass | `#0A0E27` body root, `#06071A` brand loading, dark auth, dark content-hub cards | Legacy theme | **Remove from operator surfaces** |

**Verdict:** the palette is *meaningful in principle* but has two problems to standardize later: (1) **amber does double duty** (brand identity vs warning) — pick one role, and (2) **decorative gradients** add hues with no semantic value. Success/red are used honestly post-PX.

---

## 8. Navigation / IA Audit

**Current sidebar (`Sidebar.tsx`):**
- **Home:** Dashboard
- **Create (إنشاء):** Brand Brain · Strategy · Campaigns · Content Hub · Calendar · Media · Templates  ← **7 items**
- **Intelligence (ذكاء):** Analytics · Score History
- **Connect (اتصال):** Connections (badge "setup")
- **Bottom:** Credits/Upgrade · Settings · Billing · collapse · language · user
- **Hidden (beta, correct):** Studio, Sentinel, Vex, Paid-campaigns

**Core vs secondary**
- **Core operator journey:** Dashboard → Brand Brain → Strategy → Campaigns/Content → Calendar → Connections. These belong in primary nav.
- **Premature/secondary:** **Media** and **Templates** (utility, not journey) inflate the Create group to 7; **Score History** is a power-user view (could nest under Brand Brain).
- **Overlap:** **Campaigns vs Content Hub** — both are "your campaigns + their content." For an SME this is two doors to one room. **Calendar** also overlaps (it's the scheduled view of the same content).

**Verdict:** the "Create" group is **too long (7)** for a calm operator. For later study: collapse to the journey spine (Brand Brain · Strategy · Campaigns · Calendar · Connections), fold Content Hub into Campaigns (or make it a tab), and demote Media/Templates/Score History to secondary. Navigation currently *exposes* the system rather than *guiding* the SME.

---

## 9. Dashboard Command-Center Audit

**What works:** the Marketing Operating Brief (real signals + one next-best-action), the honest Platform Readiness strip, gated new-user welcome/checklist, and real campaign cards. The bones of a cockpit are here.

**What competes:** above/near the fold the user simultaneously sees — a **journey bar (5 steps)**, a **"64" progress number** (with a "Why this number?" disclosure), **4 stat cards**, the **Operating Brief** (with its own signals incl. Brand Memory stage), **campaigns**, **AI insights**, and **alerts**. That's ~8 sections and **two different "how am I doing" numbers** (the 64 progress vs the Brand Memory stage). The single next-best-action is one card among many.

**What should move/collapse (study, not yet build):**
- Lead with **one** thing: the next best action, full-width, with the Operating Brief as its supporting context.
- Drop or merge the **journey bar** (decorative) and the **64 progress number** (a third metric the user must be taught to read).
- Keep **one** stat row, not four cards competing with the brief.
- Push insights/alerts/campaign list **below the fold**.

**Next-best-action clarity:** present and honest, but **under-weighted** — it doesn't yet feel like "the cockpit tells me the one move." That's the dashboard's core redesign opportunity.

---

## 10. Brand Brain Design Audit

- **Centrality:** Yes — after PX-2A the **Brand Memory** surface sits right after the maturity header and reads as operating memory, not a settings form. Big improvement.
- **Visual weight/placement:** correctly placed; the four truth cards (Known / Missing / Confirm / Learned) + readiness panel are **easy to scan**. Slightly heavy because it stacks above a long wizard.
- **Readiness panel:** clear, label-only, honest (organic/full/paid/analytics/auto-publish/learning).
- **Wizard placement:** the 8-step manual wizard below the memory surface is **long** for an SME and partly duplicates the PX-1 onboarding starter.
- **CTA "تحسين ذاكرة العلامة التجارية":** clear and correctly the one primary in that section.
- **Theme concern (P2):** the whole page leans **amber** (Brain icon, maturity chip, Save All) while the rest of the app is violet — Brand Brain visually reads as a *different product section*. Worth unifying.
- **Loading/error (P1):** dark `#06071A` states flash on the product's heart page.

**Preserve:** the Brand Memory cards, the "Why Early at 100%?" disclosure, the two-path start, the save-state honesty. **Study later:** amber→app-accent, shorten/standardize the wizard, fix dark loading.

---

## 11. Strategy / Content / Calendar Audit

- **Strategy — operational?** Closer after PX-2B.1: the Brand Memory stage + capability rows make it feel like a brief, not a static viewer. Still mostly a **plan viewer** (it renders a stored strategy; generation happens elsewhere). Next action ("Create your first strategy") is clear. **Defect:** the organic plan's hooks/CTAs render in **English** inside the Arabic UI — a credibility break for the core audience.
- **Content — connected?** In code yes (built from Brand Brain), but the UI doesn't *show* "built from Brand Brain," and **Content Hub overlaps Campaigns**; its cards are **dark**. Draft/approved/scheduled/published states exist but aren't prominent on the hub itself.
- **Calendar — operational?** Yes — month grid + legend distinguishing **Published / Scheduled / AI-Planned**, honest empty state, manual-vs-auto distinction. **Defect:** page chrome ("Content Calendar", "New Campaign +", "Select a day", legend) is hardcoded **English** in the Arabic app.
- **Approval vs publishing separation:** correct in the flow/code; visually it's buried inside campaign content screens rather than a clear, dedicated approval surface.

---

## 12. Empty / Error / Loading States Audit

| State | Why-here? | What's-missing? | One next step? | Avoids panic? | Avoids fake promises? |
|---|---|---|---|---|---|
| Empty dashboard (new user) | Yes (welcome + checklist) | Yes | Yes | Yes | Yes |
| Empty Brand Brain | Yes (two-path start) | Yes | Yes | Yes | Yes — exemplary |
| Empty strategy | Yes ("No strategy yet… create from Brand Brain") | Yes | Yes | Yes | Yes |
| Empty content (Content Hub) | Partial ("لا يوجد محتوى — اضغط لإنشاء") | OK | Yes | Yes | Yes |
| Empty calendar | Yes ("approved content not scheduled yet — schedule from Content Hub") | Yes | Yes | Yes | Yes — strong |
| Empty analytics | Real cards read zero + point to Connections | Partial | Yes | Yes | **PULSE tabs still over-promise** |
| Loading (dashboard) | Calm spinner | — | — | Yes | Yes |
| Loading (/brand) | **Dark `#06071A` flash** | — | — | Mostly | Yes (but jarring theme) |
| Error (/brand) | Honest retry, dark themed | Yes | Yes (Retry) | Yes | Yes |

**Verdict:** empty/error states are a **relative strength** — mostly honest, useful, calm. The two issues are the **dark `/brand` loading/error theme** and **PULSE's over-promising** analytics framing.

---

## 13. Mobile / RTL Notes

- **RTL:** **excellent and consistent** — every page renders correctly right-to-left (`dir` applied throughout); Arabic numerals, mirrored layouts, and nav all behave. No RTL breakage observed.
- **Mobile:** could **not be reliably captured** in this session (the resize tool didn't reflow the captured viewport). Code shows the affordances exist: the sidebar has `collapsed` + `onMobileClose`, content uses `max-w-*` containers and `sm:`/`lg:` grid breakpoints. **Recommendation:** a dedicated mobile-device QA pass is needed before claiming mobile-ready — particularly the **dashboard density** (8 sections will be a long scroll), the **Brand Memory 4-card grid** (verify it stacks cleanly), and **Calendar** (month grids are the classic mobile-overflow risk).

---

## 14. Design Risks by Severity

**P0 — trust/design blocker for beta**
- **PULSE analytics theatrics** (`/analytics`): the "GPT-4o · نشط" badge + "AI analysis engine" framing visually sells speculative GPT output (competitors/trends/forecasts) as measured analytics. Design amplifies the product's one real hallucination risk. *(Logic out of scope; the visual framing is the design issue.)*

**P1 — major clarity / premium**
1. **Split personality:** dark `<body>` root + dark auth + dark `/brand` loading/error + dark Content Hub cards inside a white app.
2. **Dashboard density + competing numbers** (64 progress vs Brand Memory stage; 8 sections; next-action under-weighted).
3. **Inconsistent primary action** (violet/black/amber buttons; two primaries on the dashboard header).
4. **Amber overloaded** (brand identity vs warning) and **Brand Brain themed amber** vs violet app.
5. **English inside Arabic** (strategy hooks/CTAs; Calendar chrome).

**P2 — important**
6. Campaigns ↔ Content Hub overlap; Media/Templates inflate primary nav.
7. Decorative gradient top-bars (color without meaning) across many cards.
8. Stat-card rows repeated on 4 pages (vanity density).
9. Brand Brain wizard length / duplication with onboarding.

**P3 — polish**
10. Faint captions (`text-4`), inconsistent heading scale, mono in chrome.
11. Residual emojis in product chrome (Settings badge, learnable-field icons).
12. Minor Arabic spelling drift ("قيد التطور" vs "قيد التطوّر").

---

## 15. What to Preserve

- The **light operator token system** (`--nx-*`), violet primary, soft white cards, border/radius language.
- **Connections** and **Settings** layouts — use them as the reference for "calm and correct."
- The **Brand Memory** four-card surface + readiness panel + "Why Early at 100%?" disclosure.
- **Onboarding's** calm single-column wizard (the best-structured flow).
- **Honest copy + empty states** earned in PX-1/2A/2B — do not regress them.
- **Excellent RTL** behavior.

## 16. What to Redesign (later, not now)

- **Kill the dark remnants:** make the root, auth, `/brand` loading/error, and Content Hub cards white/operator.
- **One primary system:** a single primary-button look; one primary action per screen; recolor Brand Brain to the app accent.
- **Dashboard as a true cockpit:** lead with one next-best-action; collapse the journey bar + the 64 number; one stat row; push the rest below the fold.
- **IA simplification:** journey-spine sidebar; fold Content Hub into Campaigns; demote Media/Templates/Score History.
- **De-theatricalize PULSE** and clearly separate "real reporting" from "AI advisory."
- **Language integrity:** Arabic generated content + Calendar chrome.

## 17. Recommended Next Design Study

**Study the Dashboard command-center redesign first.** Reasons: (a) it's the highest-traffic surface and the one that most determines "does this feel like an operator cockpit"; (b) it's where the density + competing-metrics + under-weighted-next-action problems concentrate; (c) fixing it forces the **one-primary-action** and **one-number** decisions that then cascade to every other page. The dark-remnant cleanup is a close second (smaller, mechanical, high premium-impact) and can run in parallel as a separate "theme unification" study. Brand Brain, Strategy, Connections, and Settings are already close to target and should be studied **last**.

## 18. Screenshots / Visual Notes (captured live this session)

- **/dashboard** — dense; journey bar + 64 progress + stat cards + Operating Brief ("ذاكرة العلامة التجارية: مبكرة" now correct) + insights + alerts. Calm white but crowded.
- **/brand** — Brand Memory surface renders well (Known/Missing/Confirm/Learned + readiness "مبكرة"); amber-themed header; (loading/error states are dark per code).
- **/strategy** — capability card "ذاكرة العلامة التجارية: مبكرة" + organic/full/paid/analytics/auto-publish rows; organic plan hooks shown in **English**.
- **/content-hub** — white page, **dark** campaign cards ("لا يوجد محتوى", "اضغط لإنشاء المحتوى").
- **/campaigns** — white; **black** "حملة جديدة" primary; 3 stat cards + filters + list (loading).
- **/calendar** — month grid + Published/Scheduled/AI-Planned legend; **English** chrome.
- **/connections** — honest per-platform rows (Facebook "جاهز للنشر اليدوي", LinkedIn "متصل، لكن صلاحية النشر غير مؤكدة"); cleanest surface.
- **/analytics (PULSE)** — real stat cards + "GPT-4o · نشط" AI-engine tabs (Competitors/Trends/Forecast) — theatrical.
- **/settings** — clean white, secondary nav (Profile/Security/Linked/Subscription/Danger); one "📧" emoji badge.
- **Code/tokens** — root `<body>` dark `#0A0E27`; `--nx-violet #5E5CE6`, `--nx-orange #D97706`; Inter + Noto Sans Arabic + Space Grotesk + JetBrains Mono; legacy dark tokens retained.
- **Mobile** — not reliably captured (resize didn't reflow); RTL verified correct on desktop. Dedicated mobile QA recommended.
