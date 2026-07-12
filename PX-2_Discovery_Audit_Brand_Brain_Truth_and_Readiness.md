# PX-2 Discovery Audit — Brand Brain Truth Summary & Readiness Model

**Type:** Discovery / report only. No code changed, no branch, no deploy. Wallet/billing/credits/analytics/PULSE/publishing/paid/dashboard/connections untouched.
**Method:** Code inspection of the deployed `main` (post-PX-1) on `Kimi4567/Nexus-ai`.
**Date:** 19 June 2026
**Principle under test:** Brand Brain must be the *trusted operating memory of an AI Marketing Operator* — not a settings page.

Evidence tags: **[Confirmed]** seen in code · **[Verify]** needs runtime/UI check · **[Risk-Px]** severity.

---

## 1. Executive Summary

The Brand Brain truth system is **genuinely well-built and honest at its core** — markedly better than most of the product. Readiness is evidence-based, the maturity-vs-completeness gap is openly explained to the user, and learning is strictly user-gated (nothing is applied to memory without an explicit Accept). This is a strong foundation that should be **preserved, not rebuilt**.

The real problem is **fragmentation and provenance loss**, not dishonesty:

1. **Four different brand-scoring functions** compute "how good is this Brand Brain," each with a different field set and math (`getBrandBrainReadiness`, `calculateBrandMaturity`, `scoreBrandReadiness`, `getBrandCompleteness`). The *copy* has been carefully reconciled (one maturity status drives readiness wording), but the *numbers* are not — the dashboard can show one brand percentage while `/brand` shows another, and the team has patched this with "disambiguate from maturity" notes rather than unifying. **[Risk-P1]**
2. **"Assumed / inferred" provenance is transient.** The assisted-draft flow beautifully labels each suggestion as extracted / observed / inferred with confidence — but once the user applies it, that provenance is **lost**; the saved Brand Brain stores no per-field "source" or "confidence," so an AI-inferred price point and a user-typed brand name look identical afterward. **[Risk-P1]**
3. **Generation reads Brand Brain silently.** Strategy/content/brief routes consume brand fields but never tell the user *which* fields were used or *what was assumed*. The operator memory feeds the work invisibly. **[Risk-P2]**
4. **Learning is real but narrow and partly invisible.** Only three triggers feed it (strategy generated, content approved, post performance); edits, rejections, manual-publishing, and explicit feedback do not. Learned items show source + reason + status, but **not date or confidence**. **[Risk-P2]**
5. **Arabic:** `/brand` still uses the transliteration **`كردت`** throughout (PX-1 fixed onboarding, not Brand Brain), and internal learnable-field metadata carries emoji. **[Risk-P2/P3]**

**Is Brand Brain the heart yet?** Closer than any other surface, but **not yet**. It still reads as an excellent *brand profile + review queue*, because (a) the four categories Known/Missing/Assumed/Learned are not co-presented as one operating-memory view, (b) assumptions don't persist, and (c) nothing downstream visibly says "this was built from your Brand Brain."

---

## 2. Current Brand Brain Architecture

**Data store:** `BrandProfile` (Prisma), one per workspace (`@@unique([workspaceId])`). ~50 fields across identity, voice, audience, offer, visual, performance memory, competitor, strategy-requirement (PR-2A), and v2 (PR-H2: `languagePreference`, `verifiedProof`, `websiteUrl`, `contentSamples`, `aiInsights`). **[Confirmed]**

**Write paths:**
- `POST /api/brand` — upsert of the whole field set (used by the manual wizard "Save All" and by PX-1 onboarding).
- `PATCH /api/brain/proposals` (action `accept`) — applies a single learned field (array merge / strategicNotes append / string replace).
- `POST /api/brand/scan-website` + `POST /api/brand/analyze-content` — produce *suggestions* (review-before-apply), do not write directly.

**Read paths (consumers):** `/brand` page, `getBrandBrainReadiness` gate (strategy `run-full`), `calculateBrandMaturity` (brand header + dashboard readiness copy), `scoreBrandReadiness` (dashboard Operating Brief signal), content-plan generation, creative-brief generation, `brain/learn` (reads current state to avoid re-proposing). **[Confirmed]**

**Four scoring layers (the core architecture finding):**

| Function | File | Inputs | Output | Where used |
|---|---|---|---|---|
| `getBrandBrainReadiness` | `brandReadiness.ts` | 5 required (brandName, industry, description, targetAudience, topPlatforms) @70% + 5 recommended (competitorNotes, writingStyle, avoidKeywords, audienceLocation, primaryOffer) @30% | `{ready, score 0-100}` | **Gates** generation (run-full) |
| `calculateBrandMaturity` | `brandMaturity.ts` | completeness(30: 8 fields) + memoryDepth(50: hooks/angles/pains/tone/advantages) + learningActivity(20: accepted learnings) | `{score 0-100, status}` | `/brand` header (45/100), dashboard readiness **copy** |
| `scoreBrandReadiness` | `marketing-intelligence.ts` | 8 booleans (brandName, industry, description, targetAudience, primaryOffer, hooks‖angles, topPlatforms, aiInsights) | `0-100%` | Dashboard Operating Brief **"Brand memory %" signal** + stage label |
| `getBrandCompleteness` | `useBrandBrain` hook | form fields | `{score, missing}` | `/brand` completeness **bar (100%)** |

`getBrandReadinessCopy` (brandReadiness.ts) is the designated single source of truth for *wording* (active ≥80 / building 50–79 / needs_data <50), and is correctly fed from `calculateBrandMaturity`. The inconsistency is that the dashboard *also* renders a separate **numeric** brand percentage from `scoreBrandReadiness`, which the code itself flags as needing "disambiguation from maturity (45)."

---

## 3. Field Inventory

Source = user-provided (form/onboarding) · learned = via accepted proposals · inferred = assisted scan/analyze suggestion (only if user applies). "In maturity?" = counts toward `calculateBrandMaturity`. "Visible truth summary?" = appears in the `/brand` review/indicators view.

| Field (schema) | UI area | Req? | Source | Used by | In maturity? | Visible in truth summary? |
|---|---|---|---|---|---|---|
| `brandName` | Business basics | required (gate) | user | gate, maturity, dashboard, gen | yes (5) | yes |
| `industry` | Business basics | required | user | gate, maturity, gen | yes (5) | yes |
| `description` | Business basics | required | user | gate, maturity, dashboard | yes (5) | yes |
| `primaryOffer` | Offer | recommended | user/inferred | maturity, dashboard, paid/funnel/full caps, gen | yes (5) | yes |
| `targetAudience` | Audience | required | user | gate, maturity, gen | yes (3) | yes |
| `audienceAge` | Audience | optional | user | maturity | yes (2) | partial |
| `audienceLocation` | Audience | recommended | user | maturity, full/paid caps, gen (region) | yes (2) | partial |
| `topPlatforms` | Channels | required | user | gate, maturity, content-plan | yes (3) | yes |
| `businessGoal` | Goals (PR-2A) | optional | user | full/kpi caps, gen | no | partial |
| `marketingBudget` | Goals (PR-2A) | optional | user | paid/kpi caps | no | partial |
| `conversionDestination` | Goals (PR-2A) | optional | user | paid/funnel caps | no | partial |
| `leadHandling` | Goals (PR-2A) | optional | user | funnel cap | no | partial |
| `uniqueAdvantages[]` | Offer | recommended | user/learned | full cap, gen (uniqueValue), maturity | yes (depth ≤5) | yes |
| `competitors[]` / `competitorNotes` | Market | recommended | user | competitor cap (low), gen | no | partial |
| `writingStyle` | Voice | recommended | user | gate-recommended | no | partial |
| `toneKeywords[]` | Voice | optional | user/learned | maturity depth (≤5) | yes | via learned timeline |
| `avoidKeywords[]` | Voice | recommended | user | gate-recommended | no | partial |
| `winningHooks[]` | (learned) | — | learned | maturity depth (≤20), gen | yes | learned timeline |
| `winningAngles[]` | (learned) | — | learned | maturity depth (≤10) | yes | learned timeline |
| `audiencePainPoints[]` | Audience | optional | user/learned | maturity depth (≤10), brief | yes | partial/learned |
| `audienceDesires[]` | Audience | optional | user/learned | brief | no | learned timeline |
| `strategicNotes` | (freeform) | optional | user/learned | gen context | no | learned timeline (appended w/ date) |
| `languagePreference` | (PR-H2) | optional | user | — (capture only) | no | **no (CLIENT_NEVER_SHOW)** |
| `verifiedProof[]` | (PR-H2) | optional | user only | — | no | **no (never AI-suggested)** |
| `websiteUrl`, `contentSamples[]` | Assisted start | optional | user | scan/analyze input | no | no |
| `aiInsights` (Json) | — | — | inferred | dashboard scoreBrandReadiness checks `hasAiInsights` | no | no |
| visual: `visualStyle`, `colorPalette`, `logoUrl` | Visuals | optional | user | brief/visuals | no | partial |
| `pricePoint`, `averageOrderValue`, `grossMargin`, `customerLifetimeValue`, `salesCycleLength`, `seasonality`, `pastAdResults`, `secondaryOffers`, `customerObjections`, `complianceNotes`, `failedAngles` | various/PR-2A | optional | user | caps/gen context | no | mostly no |

**Notable:** `aiInsights` (AI-inferred) silently raises the dashboard `scoreBrandReadiness` by one of eight checks — an inferred artifact nudging a "Brand memory %" the user reads as fact. **[Risk-P2]** `languagePreference`/`verifiedProof` are deliberately hidden from client truth views (defense-in-depth against fake proof) — good, but means the user can't see/confirm their own stored language preference.

---

## 4. Readiness Model Inventory

**Completeness (the `/brand` bar):** `getBrandCompleteness(form)` — percentage of expected form fields filled. Can reach **100%** once the wizard fields are complete. **[Confirmed]**

**Maturity (the 45/100 stage):** `calculateBrandMaturity` = `completeness(≤30) + memoryDepth(≤50) + learningActivity(≤20)`. **[Confirmed]**

**Why 45/100 while completeness is 100%:** Completeness only measures the **setup form**. Maturity additionally requires **memory depth** (winning hooks/angles/pains/tone/advantages — most of which arrive via the *learning loop*, not the starter form) and **learning activity** (count of *accepted* learnings). A brand-new profile with every form field filled scores ~30 completeness + low memoryDepth + 0 learning ≈ **45**, correctly labelled "Early." The `/brand` page explains this verbatim in a "Why is maturity 'Early' when completeness is 100%?" disclosure — **an exemplary honesty pattern.** **[Confirmed]**

**Capability readiness (advisory):** `getStrategyCapabilities` returns per-capability `{ready, missingKeys, confidence high|low|none}` for contentStrategy, fullStrategy, paidStrategy, kpiBudget, funnel, competitorAnalysis (notes-only → "low", never live data), retargeting (pixel). Advisory only — drives "to prepare paid, add X" copy; does not gate. Returns stable field **keys** (UI localizes) so non-English UIs never show mixed-language text. **[Confirmed, strong]**

**Labels in use & where:**
- `/brand`: maturity **stage** ("مبكرة/Early", number muted) + completeness bar + per-capability organic/paid readiness ("جاهز لموجز أولي", "تخطيط فقط").
- `/dashboard`: readiness **copy** from maturity status (`getBrandReadinessCopy`) **+ a separate numeric "Brand memory %"** from `scoreBrandReadiness` + a stage label from `stageFor()`.
- `/strategy`: "ذاكرة العلامة: يحتاج بيانات / متابعة إعداد ذاكرة العلامة" — a coarse needs-data state.

**Consistency verdict:** Copy is consistent by design (one status source). **Numbers are not:** dashboard "Brand memory %" (`scoreBrandReadiness`, 8 checks incl. `aiInsights`) ≠ `/brand` maturity (`calculateBrandMaturity`) ≠ completeness bar. `/strategy`'s "needs data" can also read as more pessimistic than `/brand`'s "45/100 + organic ready." **[Risk-P1]**

---

## 5. Known / Missing / Assumed / Learned Audit

| Category | Exists? | Where shown | Source visible? | Confidence visible? | Date/context? | User can approve/reject/correct? | Mixing risk |
|---|---|---|---|---|---|---|---|
| **A. Known (user facts)** | Yes | `/brand` review: BrandIndicatorsPanel "what NEXUS knows about your brand so far" + the form | implicitly (user typed it) | n/a | no | yes (edit + Save All) | Low — but indistinguishable from applied AI inferences (see Assumed) |
| **B. Missing** | Yes | `/brand` review next-action card (organic/paid `missingKeys` → "add X"); maturity `missing[]` | yes | n/a | n/a | n/a (it's a to-do) | Low |
| **C. Assumed / inferred** | **Only transiently** | Assisted-draft `ReviewSuggestions`: per-field basis (extracted/observed/inferred) + confidence + evidence, review-before-apply | **yes — but only before apply** | **yes — only before apply** | source ref only | yes (approve/skip per field) | **High after apply: provenance is dropped; inferred fields become indistinguishable from typed facts in the saved profile** |
| **D. Learned memory** | Yes | BrainTimeline ("What NEXUS has learned"): suggested/applied/dismissed, field label, source chip, reason | **yes (source chip + reason)** | **no** | source yes, **explicit date no** | yes (Accept/Dismiss); correct = dismiss + edit manually | Low |

**Headline:** The product separates these four **better than most**, but they live in **different widgets** and the **Assumed** category does not persist. There is no single "operating memory" view that says, per fact: *who said this (you / AI-inferred / learned-from-campaign), how sure, and when.* Known and Learned each have a home; Missing is contextual; Assumed evaporates on apply. This is the central gap between "great brand profile" and "trusted operating memory." **[Risk-P1]**

---

## 6. Learning Memory Audit

**Triggers present [Confirmed]:** `strategy` (after strategy generation), `approved_content` (after content-plan approval), `post_performance` (via the analytics cron → `runBrainLearning`).
**Triggers absent:** content **edited**, content **rejected/request-changes**, **manual publishing**, explicit **user feedback/thumbs**. So the loop learns from generation + approval + real performance, but not from corrective signals (edits/rejections) — arguably the highest-signal data. **[Risk-P2]**

**Learnable fields (7):** `winningHooks`, `winningAngles`, `toneKeywords`, `audiencePainPoints`, `audienceDesires`, `uniqueAdvantages`, `strategicNotes`. **[Confirmed]**

**Apply model:** GPT-4o extracts → saved as `BrainLearning` rows with `status:'pending'` → **applied only on user Accept** (`PATCH /api/brain/proposals`). Arrays merge-unique (cap 30), `strategicNotes` appends with an ISO date, others replace. Accept re-snapshots maturity. **Nothing is auto-applied.** Rate-limited 25/workspace/day; flagged internally as ~$0.013–0.02/call background COGS (uncovered by credits) — a **margin/ops risk** at scale, not a user-trust risk. **[Confirmed]**

**Visibility:** source (trigger→friendly chip) and reason (the "why") are rendered verbatim; raw field keys, proposed JSON, and trigger enums are deliberately hidden (SME-friendly). **Not shown:** an explicit **date** and any **confidence** indicator (learned proposals carry no confidence score, unlike scan/analyze suggestions). **[Confirmed]**

**Usefulness to an SME:** Moderate-to-good — items read as "Learned about Winning Hooks: the strategy identified these high-conversion patterns…", with Accept/Dismiss and an optional "View campaign." The "why" is present; the "when" and "how sure" are not. Field display names still carry emoji internally (🎣🎯) though the timeline renders a localized label. **[Risk-P3]**

---

## 7. Brand Brain Page UX Audit

**Stages:** `start` (two-path) → `edit` (8-step manual wizard) → `assistReview` (scan/analyze review-before-apply) → `review` (truth summary).

**Heart vs settings:** Improved by the M3.x work — the header leads with the **maturity stage** (number muted), the "Why Early at 100%?" disclosure is excellent, and the `review` stage shows "what NEXUS knows" + readiness + the learned timeline. But it still **operates like a wizard + review queue**: the truth summary is one stage you navigate to, not the always-present spine; assumptions aren't persisted; and there's no "what your memory is currently driving" (no downstream link to the strategy/content it powers). So: **closer to heart, still profile-shaped.** **[Risk-P2]**

**Cards & value:**
- Maturity header + "Why?" disclosure — **decision-supporting, keep.**
- Two-path start (Assisted draft w/ credit costs + safety bullets; Manual) — **still good post-PX-1, keep** (the safety bullets are exemplary). Minor: it duplicates onboarding's intent; a returning user who skipped onboarding meets a second "set up your brand" surface.
- BrandIndicatorsPanel "what NEXUS knows so far" — **keep**, but it shows known facts without distinguishing inferred-then-applied ones.
- Readiness next-action (organic/paid missingKeys, "paid is planning-only, no spend without approval") — **keep, strong.**
- BrainTimeline — **keep.**
- The 8-step wizard is **well-structured** (Business basics → … → Goals → Review) but **long** for an SME, and overlaps the PX-1 starter fields (a user may enter business basics twice across onboarding and `/brand`).

**Save states:** Clear — "nothing is applied to your brand memory until you approve," "applied to draft — not saved yet," and Save All as the only persistence. **Strong, keep.**

**Misleading CTAs / technical labels:** None materially misleading. Technical-leaning: "كردت", and capability labels are fine. The maturity number (45/100) is correctly subordinated to the stage word.

---

## 8. Arabic Copy Audit (Brand Brain)

- **`كردت` (transliteration of "credits")** — used repeatedly on `/brand` (credit-cost line "تكلفة الكردت", scan/analyze costs "3 كردت / 2 كردت", charge/refund notes "تم خصم … كردت"). Should become **"رصيد"** in a future copy pass. PX-1 already avoids it in onboarding; `/brand` is now the main offender. **[Risk-P2]**
- **Emoji in field metadata** (🎣🎯🎙️💢✨🏆📋) — internal `displayName`/`icon` for learnable fields; the timeline renders a localized label but the icon emoji still display. Against the "calm, no-emoji operator" direction. **[Risk-P3]**
- **Mixed English in Arabic** — product name "NEXUS"/"Brand Brain" appears inside Arabic copy alongside "ذاكرة العلامة"; pick one consistent treatment. The strategy page's generated organic **hooks render in English** inside the Arabic UI (pre-existing, strategy not Brand Brain, but it surfaces Brand Brain-derived content). **[Risk-P2, cross-surface]**
- **Quality where it counts is good** — maturity disclosure, "what NEXUS knows," safety bullets, and readiness copy are neutral, professional MSA. No dialect leakage found.
- **Overclaiming:** none in Brand Brain — labels are honest ("جاهز لموجز أولي", "تخطيط فقط", "مبكرة").

---

## 9. Cross-Product Dependency Map

| Consumer | Reads Brand Brain? (code) | Visible to user it was used? | Tells user *which* fields? | Shows assumptions? |
|---|---|---|---|---|
| **Dashboard** | Yes — `scoreBrandReadiness` (signal %), `getBrandReadinessCopy` (status line) | Partially (readiness line) | No | No |
| **Strategy (run-full)** | Yes — gated by `getBrandBrainReadiness`; maps brandName→companyName, industry→businessType, targetAudience, competitorNotes→competitors, audienceLocation→region, uniqueAdvantages→uniqueValue | Only as a gate ("needs data") | **No** | **No** |
| **Strategy page (/strategy)** | Reads stored strategy + a coarse brand "needs data" card | Partially | No | No |
| **Content plan** | Yes — audience, offer, connected platforms | No | No | No |
| **Creative briefs** | Yes — audiencePainPoints, audienceDesires (+ audience/offer) | No | No | No |
| **Calendar** | Indirect (consumes posts derived from the above) | No | No | No |
| **Approvals** | Feeds learning *back* (approved_content → proposals) | Via the resulting learned items | N/A | N/A |
| **Publishing** | No direct read | N/A | N/A | N/A |
| **Reporting** | `post_performance` feeds learning; analytics overview is independent | Via learned items | No | No |
| **Learning loop** | Reads current Brand Brain to avoid re-proposing; writes pending proposals | Yes (timeline) | Yes (field label) | Reason yes, confidence no |

**Pattern:** Brand Brain genuinely powers strategy, content, briefs, and learning **in code**, but the connection is **invisible at the point of use** — no surface says "this plan was built from your Brand Brain (audience X, offer Y); it assumed Z." The memory is the engine but never takes visible credit, which both undersells Brand Brain as "the heart" and hides the assumptions a trustworthy operator should declare. **[Risk-P2]**

---

## 10. Risks by Severity

**P0 — trust-breaking / hallucination**
- None *inside* the Brand Brain truth/learning system itself — it is honest, evidence-based, and user-gated. (The product's P0 hallucination risk lives in Analytics/PULSE, out of PX-2 scope.)

**P1 — major UX / truth inconsistency**
1. **Multiple brand scores, unreconciled numbers.** Four scoring functions; dashboard "Brand memory %" (`scoreBrandReadiness`, includes inferred `aiInsights`) differs from `/brand` maturity (`calculateBrandMaturity`) and the completeness bar. Copy is reconciled; numbers are not. Evidence: the dashboard code carries an explicit "disambiguate from maturity (45)" note.
2. **Assumed/inferred provenance is not persisted.** Excellent at review time, gone after apply; saved Brand Brain cannot distinguish user facts from applied AI inferences. This is the main blocker to a true "operating memory."

**P2 — important improvements**
3. Learning ignores corrective signals (edits, rejections, manual-publish, feedback) — the highest-signal data.
4. Generation reads Brand Brain silently — no "built from your Brand Brain / assumptions" surface at strategy/content/brief.
5. `/brand` still operates as wizard + review queue rather than an always-present memory spine; onboarding↔`/brand` field overlap (double data entry).
6. Arabic `كردت` → should be `رصيد`; English hooks inside Arabic strategy output.
7. `aiInsights` (inferred) silently raises a user-visible "Brand memory %".

**P3 — polish**
8. Learned items show no date or confidence.
9. Emoji in learnable-field metadata vs the calm operator direction.
10. `languagePreference`/`verifiedProof` hidden from the user's own truth view (defensible, but the user can't confirm their stored language).
11. Background learning COGS (GPT-4o, uncovered by credits) — ops/margin watch item, not user-facing.

---

## 11. What Should Be Preserved

- The **maturity model + "Why Early at 100%?" disclosure** — exemplary honesty; keep verbatim.
- **`getStrategyCapabilities`** (capability-based, key-not-prose, confidence high/low/none) — keep as the readiness backbone.
- **User-gated learning** (pending → Accept/Dismiss, nothing auto-applied; arrays merge-unique; notes appended with date) — keep.
- **BrainTimeline** honest rendering (source + reason, no raw keys/JSON) — keep.
- **Two-path start safety bullets** and **"Save All is the only persistence"** save-state language — keep.
- **`verifiedProof` = user-confirmed only** (no AI-suggested testimonials) — keep.

## 12. What Should Be Redesigned (study, not yet build)

- **Unify the brand score** into one number/state with one formula, surfaced identically on `/brand`, `/dashboard`, `/strategy` (retire or internalize `scoreBrandReadiness`/`getBrandCompleteness` as views of one model).
- **Persist provenance** per field (source: you / inferred / learned; confidence; date) so the saved Brand Brain *is* a truth ledger, and the Known/Assumed/Learned split survives apply.
- **Make Brand Brain a single operating-memory view** (Known / Missing / Assumed / Learned co-present) rather than four widgets across stages.
- **Surface Brand Brain at the point of use** ("this plan used your audience/offer; it assumed X").
- **Broaden learning triggers** to edits/rejections (corrective signal) — with the same user-gated apply.
- **Arabic pass:** `كردت → رصيد`, de-emoji, consistent "ذاكرة العلامة" naming.

## 13. Open Questions Before Product Study

1. Should there be **one** brand number, or an explicitly **layered** model (Setup % vs Memory depth vs Organic-ready) shown together — and which becomes "the" headline?
2. After applying an AI-inferred suggestion, should the field stay **flagged "AI-inferred / unconfirmed"** until the user confirms it, and should generation treat unconfirmed fields differently?
3. Should **learning from edits/rejections** be in scope, given it's the strongest signal but also the most sensitive to misread?
4. Should generation **declare assumptions** inline, and should "low-confidence" capabilities be allowed to generate at all, or only with a visible caveat?
5. Is the **8-step manual wizard** the right depth, or should `/brand` become a lighter always-on memory surface with progressive capture?
6. Should `languagePreference` be **user-visible/confirmable** (it currently drives nothing and is hidden)?

## 14. Files / Routes Inspected

- `src/lib/brandMaturity.ts` (calculateBrandMaturity, snapshotBrandMaturity)
- `src/lib/brandReadiness.ts` (getBrandBrainReadiness, getBrandReadinessCopy, getStrategyCapabilities)
- `src/lib/marketing-intelligence.ts` (scoreBrandReadiness, stageFor — dashboard signal)
- `src/hooks/useBrandBrain` (getBrandCompleteness — referenced)
- `src/app/brand/page.tsx` (stages, maturity header + "Why?" disclosure, two-path start, wizard, review, indicators, timeline)
- `src/components/brain/BrainTimeline.tsx` + `src/lib/brainTimeline.ts` (timeline render + derive)
- `src/components/BrandIndicatorsPanel` (referenced)
- `src/app/api/brain/learn/route.ts` (triggers, proposal extraction, pending)
- `src/lib/brain-learning.ts` (runBrainLearning, post_performance, pending)
- `src/app/api/brain/proposals/route.ts` (GET pending, PATCH accept/dismiss → apply)
- `src/app/api/brand/route.ts` (upsert), `scan-website` / `analyze-content` (referenced for inferred-suggestion provenance)
- `src/app/api/strategy/run-full/route.ts` (brand read + gate + field mapping)
- `src/app/api/campaigns/[id]/generate-content-plan/route.ts`, `creative-brief/route.ts` (brand reads — referenced)
- `src/app/api/dashboard/intelligence/route.ts` (brand signal consumer — referenced)
- Prisma `BrandProfile`, `BrainLearning`, `BrainScoreSnapshot` models

**Could not verify this pass [Verify]:** exact dashboard rendering of the `scoreBrandReadiness` "%" next to maturity (read from code, not re-screenshotted this session); runtime confidence/date absence in the live timeline; whether any surface other than the dashboard renders a second brand number. No runtime/paid actions were taken; this is code-level discovery only.
