# D0 Discovery Audit — First User Moment & First-Run Journey

**Type:** Discovery / report only. No code, branch, commit, or deploy. No wallet/billing/credits/analytics-PULSE/publishing/paid/connections/generation logic touched.
**Method:** Live inspection on `https://www.nexus-grow.com` (auth pages viewed live) + code inspection of the routing, onboarding, and dashboard first-run logic. Post PX-1 / PX-2A / PX-2B.
**Date:** 19 June 2026
**Lens:** The first 3 minutes after signup must build trust, not overwhelm. No fake strategy/analytics/publishing/paid readiness; one primary action per screen; calm white operator style; neutral MSA Arabic.

Severity: **P0** trust blocker · **P1** major clarity/premium · **P2** important · **P3** polish.

---

## 1. Executive Summary

The **middle** of the first-run journey is strong: PX-1 turned `/onboarding` into a calm, honest, white "Brand Memory starter," and its summary correctly states what NEXUS knows / needs / can do (paid = planning-only, auto-publish = off, analytics = not connected). That core is trustworthy and premium.

The **edges** undercut it. Two concrete first-run problems break trust and premium feel:

1. **The register page — a new user's very first screen — is visually broken (P0).** Live, it renders a light card but with **dark input fields** and a **white-on-white, invisible page title** ("أنشئ حسابك" doesn't show). The first impression is a half-migrated, slightly-broken form. Login, by contrast, is fully light and clean — so auth itself is inconsistent.

2. **The first dashboard contradicts onboarding's honesty (P0).** Onboarding promises "NEXUS will not create a full strategy … before … approvals are clear." Minutes later, the dashboard's first-run AI insight says **"Nexus will build a full strategy and ready-to-use content."** That is a direct, same-session contradiction and exactly the "fake strategy" overclaim the PX work removed elsewhere.

Plus a structural rough edge: **new users reach onboarding via a dashboard bounce** (login → `/dashboard` → workspace check → redirect to `/onboarding`), which risks a brief flash of the full cockpit before the redirect.

**Net:** the onboarding heart is excellent; the entry (register) and the exit (first dashboard) are where the first-3-minutes trust is leaking. Both are small, safe fixes.

---

## 2. Current First-Run Path Map

```
/auth/register  (light card · DARK inputs · invisible white title)        ← P0
      ↓ submit
"Verify your email" screen  (📬 emoji; next-steps incl. "publish to social")
      ↓ verify email → /auth/login
/auth/login  (light, clean, BLACK button)
      ↓ signs in → window.location = /dashboard
/dashboard  (mounts → loading spinner → fetch /api/workspaces)
      ↓ if workspaces empty → router.push('/onboarding')   ← dashboard bounce, flash risk
/onboarding  (PX-1: calm white · welcome+4 steps · honest trust note)      ← strong
      ↓ Brand Memory summary (4 cards: known / needs / readiness / next)   ← strong
      ↓ CTA "عرض الخطوة التالية" → /dashboard
/dashboard  (stage = 'activating': journey bar + stat cards[zeros]
             + Operating Brief + insights[OVERCLAIM] + empty campaigns)     ← P0 copy + density
```

**Routing decision (code):** `login` redirects to `?redirect` or `/dashboard`. The **dashboard** decides first-run: `useEffect` fetches `/api/workspaces`; if `length === 0` → `router.push('/onboarding')`. `workspace/create` also redirects to `/onboarding`. So the condition is **workspace existence**, evaluated **on the dashboard**, not at login. There is therefore a window where the dashboard is mounting/among-loading for a brand-new user before the bounce.

---

## 3. Auth Visual Audit

| | Live result | Verdict |
|---|---|---|
| **/auth/login** | Light lavender background, white card, dark readable text, NEXUS logo, EN/AR toggle, "تسجيل الدخول" + "أهلاً بعودتك", clean inputs. **Button is black** (not app violet). | Matches operator app; only the black button breaks the accent system. **Mostly good.** |
| **/auth/register** | Light card, but **input fields render dark grey** with faint placeholders, and the **page title is white-on-white → invisible** (only the subtitle "ابدأ مجاناً — لا حاجة لبطاقة ائتمان" shows). Hybrid/broken theme. | **P0 — broken first impression.** |
| **Verify-email screen** | Dark-styled "done" state with a **📬 emoji** and next-steps hints (incl. "📤 publish content to social media"). | Emoji + dark in first-run; "publish to social" slightly implies easy publishing. **P2.** |
| **Root/body first paint** | `<body>` defaults to dark navy `#0A0E27 / text-white`; pages paint white on top. | Flash-of-dark risk. **P1 (shared with PX-D1).** |

- **Split personality:** yes — login is fully light, register is a light/dark hybrid (and broken), verify screen is dark-ish. Auth is not internally consistent, let alone consistent with the app.
- **CTAs clear:** yes (Login / Create account), but the primary button is **black**, not the app's violet — same inconsistency flagged in PX-D1.
- **Arabic:** professional MSA; "ابدأ مجاناً — لا حاجة لبطاقة ائتمان" is honest and good.
- **Trust/overclaim:** auth copy itself is fine; the only issue is the verify-screen "publish content to social media" hint, which slightly over-implies publishing.

---

## 4. Onboarding Audit (`/onboarding`)

**Strong — this is the best-built flow in the product (PX-1).**
- **First screen:** calm white (`#F8FAFC`), centered single card, title "لنبدأ بفهم نشاطك التجاري", subtitle explaining *why* NEXUS needs info, a "ماذا سيحدث بعد ذلك؟" block, and a trust note: "لن ينشئ NEXUS استراتيجية كاملة أو ينشر أي محتوى قبل أن تكون المعلومات والموافقات المطلوبة واضحة." **No emojis, no dark/glass.**
- **One primary CTA:** "ابدأ تعريف نشاطك التجاري"; quiet secondary "سأكمل ذلك لاحقًا". Correct hierarchy.
- **Steps/fields:** 4 short steps (business basics → goal/market → audience/offer → marketing status), minimal and useful; chips + short inputs, not a long technical form.
- **Skip:** routes to an in-page **limited state** with one primary CTA ("ابدأ تعريف نشاطك التجاري") + quiet "go to dashboard" — no confusion.
- **Saving:** honest — saves to Brand Brain via `/api/brand`; surfaces a retry on failure; **never** a fake "done."
- **Final summary:** 4 cards (what NEXUS knows / what needs clarification / what needs confirmation / what NEXUS has learned) + readiness panel + CTA "عرض الخطوة التالية → /dashboard" (PX-1.1 made this truthful — it no longer claims to generate a brief).
- **Feels like Brand Memory starter, not a generic form:** yes.

**Only nits:** none material. This stage is the trust anchor and should be preserved verbatim.

---

## 5. Brand Memory Summary Audit

The onboarding summary already implements the four-truth model and is honest:
- **Knows:** the saved starter fields. **Needs clarification:** field-derived missing items. **Needs confirmation:** truthful empty state (no fabricated assumptions). **Learned:** real count or honest empty state.
- **Readiness panel:** organic = ready for initial brief, full = needs more info, **paid = planning-only, auto-publish = not enabled, analytics = not connected**, learning = early. This is exactly the "what NEXUS can / cannot do" the brief asks for.
- Calm white, neutral MSA, no emojis, no overclaim.

**Verdict: strong — preserve.** It is the clearest "where am I / what does NEXUS know / what next" moment in the product.

---

## 6. First Dashboard State Audit (post-onboarding)

After onboarding the user has a workspace + brand but no campaigns → `getDashboardStage` = **'activating'**. They land on the dashboard and see:
- **Gated correctly (good):** beginner Welcome banner and full Checklist are **hidden** (only shown for 'new'); the compact **Journey bar** shows as the single next-step surface.
- **Always rendered (the problem):** the **4 stat cards** (all zeros), the **Marketing Operating Brief** (with its "64 progress" number + Brand Memory stage), the **AI Insights** list, and the **empty campaigns** grid.
- **The overclaim (P0):** because `stats.campaigns === 0`, the insights builder pushes: *"أنشئ أول حملة — Nexus سيبني لك استراتيجية كاملة ومحتوى جاهز" / "Create your first campaign — Nexus will build a full strategy and ready-to-use content."* This contradicts onboarding's promise and re-introduces "fake full strategy" language in the first-run.
- A second insight promotes **PULSE** ("activate PULSE to find the best publishing time") — pushing the trust-risk analytics surface early.

**One clear next action?** Partially — the Journey bar + next-best-action exist, but they compete with stat cards, the Brief's own number, and the insights (one of which overclaims). For a just-onboarded SME, it's **more cockpit than a first session needs**, and the one overclaiming line is actively harmful.

**New/empty user (no workspace):** redirected to `/onboarding` before the full dashboard — *but* the dashboard mounts and runs `load()` in parallel with the workspace check, so a brief **flash** of the empty cockpit before the bounce is possible (race between `load()` finishing and the redirect firing).

---

## 7. Progressive Dashboard Audit

**Partially progressive — beginner surfaces yes, core cockpit no.**

`getDashboardStage` (Trust Sprint #7) derives stage from real signals and is well-designed:

| Stage | Condition | Welcome | Checklist | Journey bar |
|---|---|---|---|---|
| loading | brand not loaded, no campaigns | hidden | hidden | hidden (anti-flash) |
| new | no brand, no campaigns | **show** | **show** | show |
| activating | brand set, no campaigns | hidden | hidden | show |
| established | has campaigns | hidden | hidden | show (self-hides when funnel done) |

**What this gets right:** the beginner welcome/checklist/journey are gated on real state, and `loading` avoids flashing a new-user state. Good.

**What it does NOT gate (renders from day one regardless):** the **stat cards ×4**, the **Operating Brief**, the **AI insights**, and the **campaigns grid**. So a brand-new/activating user sees the full analytical cockpit at zero-data state.

| Section | Useful day one? | Recommendation (study) |
|---|---|---|
| Journey bar / next action | Yes | Keep — make it the hero |
| Welcome / checklist (new only) | Yes (new) | Keep |
| Operating Brief | Partially | Simplify; drop the 64 number at zero state |
| Stat cards ×4 (zeros) | **No** | Delay/soften until data exists |
| AI insights | **No (and overclaims)** | Fix copy; delay until meaningful |
| Campaigns grid (empty) | No | Soften empty state |
| Platform readiness strip | Yes (honest) | Keep |

**Verdict:** the *onboarding-surface* progressivity is solid; the *core cockpit* is mostly static and appears too early. Stats/insights/campaigns should soften or delay until there's real data.

---

## 8. First-Trust Copy Audit

Does the first-run journey clearly say the five trust statements?

| Trust statement | Stated? | Where |
|---|---|---|
| Won't **publish** automatically without approval | **Yes** | Onboarding trust note + summary "auto-publish: not enabled" |
| Won't **run ads** without approval | **Yes** | Onboarding summary "paid: planning-only" |
| Won't **invent analytics/results** | **Yes** | Onboarding summary "analytics: not connected" |
| **Starts by understanding the business** | **Yes** | Onboarding's entire premise |
| First output is **initial guidance, not a full proven strategy** | **Yes in onboarding** (CTA "View next step", honest) … **BUT contradicted on the dashboard** | Onboarding ✓ ; Dashboard insight ✗ ("Nexus will build a full strategy and ready-to-use content") |

**Verdict:** onboarding nails all five. The **dashboard insight overclaim breaks the fifth** in the same session — the single most important copy fix in the first-run journey. The verify-email "publish to social media" hint is a minor secondary overclaim.

---

## 9. Design Issues by Severity

**P0 — trust blocking first-run**
1. **Register page broken theme:** dark inputs + invisible white-on-white title on a light card. A new user's first screen looks half-broken. *(Auth design only.)*
2. **Dashboard first-run overclaim:** "Nexus will build a full strategy and ready-to-use content" — contradicts onboarding's honesty; re-introduces fake-strategy language. *(One copy string.)*

**P1 — major clarity / premium**
3. **Dashboard bounce for new users** (login → dashboard → redirect to onboarding) with a possible flash of the empty cockpit.
4. **Auth split personality / dark root:** login light, register hybrid, verify-screen dark, body root `#0A0E27`.
5. **First dashboard density at zero-data:** stat cards + Brief number + insights + empty campaigns all render before there's data; the one next-action competes.

**P2 — important**
6. Verify-email screen uses **emoji** (📬, 🚀, 📤) and "publish to social media" hint in first-run.
7. **Black primary buttons** on auth (login/register) vs the app's violet — accent inconsistency at first touch.
8. PULSE promoted in first-run insights before analytics exist.

**P3 — polish**
9. Stat-card zero states could read as a soft "nothing yet" rather than "0".
10. Minor: login/register button radius/weight vs app buttons.

---

## 10. What to Preserve

- **`/onboarding` (PX-1)** end-to-end — copy, calm white style, 4 steps, skip behavior, honest summary. The trust anchor.
- The **Brand Memory summary** four-truth cards + readiness panel.
- **`getDashboardStage` / progressive beginner gating** (Trust Sprint #7) — keep and *extend* its logic to the core cockpit.
- **Login page's light, clean layout** (just fix the button color).
- The honest **trust note** wording — reuse it verbatim wherever first-run touches strategy/publishing/ads/analytics.

## 11. What to Redesign (later, not now)

- **Auth theme unification:** make register fully light (visible title, light inputs), align verify screen, de-emoji, app-violet primary buttons.
- **First-run routing:** decide onboarding vs dashboard **before** the dashboard renders (gate on workspace/brand at the shell/router level), removing the bounce/flash.
- **First-session dashboard:** extend progressive gating to stats/insights/campaigns so a just-onboarded user sees a calm, guided, single-next-action cockpit, not the full analytical view at zero data.
- **De-promote PULSE** from first-run insights.

## 12. Recommended First Implementation PR (smallest safe)

**Fix the dashboard first-run overclaim copy — one string, display-only, highest trust value.**

Change the `stats.campaigns === 0` insight from *"Nexus will build a full strategy and ready-to-use content" / "أنشئ أول حملة — Nexus سيبني لك استراتيجية كاملة ومحتوى جاهز"* to honest, approval-aware wording consistent with onboarding, e.g.:
- AR: "أنشئ أول حملة — سيساعدك NEXUS على التخطيط وإنشاء المحتوى، وكل خطوة تحت موافقتك."
- EN: "Create your first campaign — NEXUS helps you plan and draft content, with your approval at every step."

This is a single copy change in the dashboard insights builder (`dashboard/page.tsx`, the `built.push` for `campaigns === 0`), touches no logic, no schema, no generation, no forbidden areas, and removes the only outright trust contradiction in the first 3 minutes. **Smallest safe, highest impact.**

*(Close second, also small and safe: the register-page theme fix — make the title visible and inputs light — which repairs the broken first impression. Recommend as the very next PR after the copy fix.)*

## 13. Screenshots / Visual Notes (captured live)

- **/auth/login** — light lavender bg, white card, dark readable text, EN/AR toggle, "تسجيل الدخول / أهلاً بعودتك", clean fields, **black** login button, "أنشئ حساباً" link. Clean and on-brand except button color.
- **/auth/register** — light card, **dark grey input boxes** with faint placeholders, **page title invisible** (white text on white), subtitle "ابدأ مجاناً — لا حاجة لبطاقة ائتمان" visible. Hybrid/broken theme.
- **/onboarding** (prior session) — calm white, one primary CTA, honest trust note, 4 steps, honest 4-card summary. Strong.
- **/dashboard (activating)** (prior session) — journey bar + 4 stat cards + Operating Brief ("ذاكرة العلامة التجارية: مبكرة" correct) + insights (incl. the overclaim string) + empty campaigns. Busy at zero-data.
- **Code** — login redirect `→ /dashboard`; dashboard `useEffect` redirects no-workspace users to `/onboarding`; `getDashboardStage` gates beginner surfaces; overclaim at `dashboard/page.tsx` `campaigns === 0` insight; register uses `text-white` + dark inputs on a light card; body root `#0A0E27`.
