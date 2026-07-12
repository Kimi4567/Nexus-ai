# PX-2B Study — Unified Brand Brain Readiness Model

**Type:** Study / contract design only. No code, branch, commit, or deploy. Wallet/billing/credits/refunds/analytics/PULSE/publishing/paid/dashboard/connections untouched.
**Method:** Code inspection of deployed `main` (post-PX-2A, merge `baa0249`) + consumer mapping of every scoring function.
**Date:** 19 June 2026
**Purpose:** Define the product + technical contract for a unified readiness model so the next implementation PR is a safe label/derivation alignment — not a rebuild.

---

## 1. Executive Recommendation

**Adopt one canonical depth model and three *derived* user-facing layers. Introduce no new formula, no new number, and no schema change.**

The good news from the code: a single source of truth already exists — `calculateBrandMaturity()` produces `{ score, status, breakdown: { completeness, memoryDepth, learningActivity } }`. Everything the user should see can be **derived from values that already exist**:

- **Setup completeness** = `breakdown.completeness` (the 8 essential setup fields, max 30) → expressed as a simple "essentials filled" state, *not* a competing percentage.
- **Memory maturity** = the existing maturity `status` (Early / Developing / Strong), driven by `memoryDepth + learningActivity`.
- **Capability readiness** = `getStrategyCapabilities()` (organic / full / paid / content), already the capability backbone.

The P1 confusion is caused by **two avoidable things**, both fixable as cleanup:
1. `scoreBrandReadiness()` (internal to the dashboard brief) emits a **second brand percentage** that can disagree with the `/brand` maturity number. → **Retire the percentage; show the maturity *label* instead.**
2. `getBrandCompleteness()` is **mis-named** — it returns the maturity score, not completeness — which is exactly the "100% vs Early" trap. → **Rename to the truth, and derive a real setup-completeness state from the existing breakdown.**

**Headline answer:** the user should see **a stage label, never a bare number as the headline** — "Brand Memory: Early / Developing / Strong" — with the three layers (Setup, Memory, Capabilities) available as honest detail. One model, one label, three views.

---

## 2. Current Scoring Problem (grounded in consumers)

| Function | What it really computes | Where consumed (verified) | Problem |
|---|---|---|---|
| `calculateBrandMaturity` | The **one true depth score** 0–100 = completeness(≤30)+memoryDepth(≤50)+learningActivity(≤20), plus `status` + `breakdown` | `api/brand`, `analytics/insights`, `useBrandBrain`, `brandIndicators`, `brandReadiness` (copy), `operatingBriefStatus` | None inherently — this is the spine. The problem is other functions diverge from it. |
| `getBrandCompleteness` | **Thin wrapper** → returns `maturity.score` + `maturity.missing` (NOT completeness) | `/brand` only | **Mis-named.** Drives the `/brand` "45/100" chip while being called "completeness" — the root of the "100% vs Early" confusion. |
| `scoreBrandReadiness` | A **different** 0–100% from 8 booleans incl. AI-inferred `aiInsights` | **Internal to `marketing-intelligence.ts` only** (no external importers) — emits the dashboard "Brand memory %" signal | **The actual conflicting number.** Different field set + math from maturity; the dashboard code already had to add a "disambiguate from maturity (45)" note. |
| `getBrandBrainReadiness` | **Binary organic gate** (5 required, 5 recommended) → `{ ready, score }` | `dashboard`, `strategy/run-full` (gate), `campaigns/new`, `campaigns/[id]`, `RunFullStrategyModal`, `StrategyActionCard`, `lifecycle-emails`, `brandIndicators` | Not a "maturity score" — it's a **gate**. Its `score` (req 70% / rec 30%) is a *third* number if ever shown to users. Should never be displayed as "how mature." |
| `getStrategyCapabilities` | Per-capability `{ ready, missingKeys, confidence }` | `/brand`, `brandIndicators`, `strategyNormalize`, `strategist`, `orchestrator` | Healthy — the capability backbone. Underused as the *single* capability source across surfaces. |
| `getBrandReadinessCopy` | Maturity `status` → honest localized copy | `dashboard`, `strategy` | Healthy — already the shared *messaging* source. Just isn't paired with a shared *number/label* rule. |
| `getBrandIndicators` | Composes organic/paid readiness + `memoryRichness` from the above | `/brand`, `campaigns/[id]`, `BrandIndicatorsPanel` | Healthy — a partial unifier to build on. |

**Net:** there are not "four equal scores." There is **one spine (maturity)** plus **one gate (organic readiness)** plus **one capability layer** — and **two cleanup defects** (`scoreBrandReadiness` % and the `getBrandCompleteness` misnomer) that manufacture the contradictions.

---

## 3. Proposed User-Facing Model

**The three-layer model in the brief (A Setup / B Memory / C Capability) is correct — with one critical refinement: Setup and Memory must be visibly distinct, and only Memory may be the headline.**

| Layer | Question it answers | Source (existing) | User expression | May be the headline? |
|---|---|---|---|---|
| **A. Setup completeness** | "Have I given NEXUS the essentials?" | `breakdown.completeness` (8 fields / 30) | A short **state** + a "fields remaining" list — e.g. "Essentials complete" / "3 essentials left". **No standalone %** as headline (a % here is what collides with maturity). | No |
| **B. Memory maturity** | "How much has NEXUS actually learned about my brand?" | maturity `status` (Early/Developing/Strong), from `memoryDepth + learningActivity` | The **headline stage label**. Number optional and always subordinate, always with the "why" disclosure. | **Yes — the single headline** |
| **C. Capability readiness** | "What can NEXUS safely do right now?" | `getStrategyCapabilities` | Per-capability status labels (organic / full / paid / content) — already shipped in PX-2A. | No (it's a list, not a headline) |

Why this ordering: an SME owner doesn't care about an abstract score; they care about **"what can it do for me now" (C)** and **"is it getting smarter (B)"**. Setup (A) is a means to those ends. So **B is the identity headline, C is the action surface, A is the to-do.** This matches PX-2A's surface and just needs consistent derivation.

**Should there be a single numeric score?** **No headline number.** Keep `calculateBrandMaturity.score` as an **internal** value (and for the Score History trend, which is legitimately a number-over-time). User-facing surfaces lead with the **stage label**; any number shown sits *beside* the label, muted, with the existing "Why Early at 100%?" explanation. This is the only way to prevent "completeness vs maturity" confusion permanently: there is only ever **one** number in play (maturity), and it's never presented as completeness.

---

## 4. Function-by-Function Decision

| Function | Decision | Detail |
|---|---|---|
| `calculateBrandMaturity` | **Keep — promote to the single canonical model.** | The one source for the headline stage, the `breakdown` (feeds Setup layer), and Score History. All surfaces derive from this or its `status`. |
| `getBrandReadinessCopy` | **Keep — the shared copy layer.** | Continue as the only place that turns maturity `status` into words for `/dashboard` and `/strategy`. Extend to also expose the Setup state + capability summary so every surface speaks identically. |
| `getStrategyCapabilities` | **Keep — the single capability source.** | Make it THE capability authority for `/brand`, `/strategy`, `/dashboard`, content/briefs. Already used by the strategist/orchestrator, so generation and display agree. |
| `getBrandIndicators` | **Keep — the composition layer.** | Already blends organic/paid readiness + `memoryRichness`. Extend so it returns the three named layers (A/B/C) in one object the UI consumes. |
| `getBrandBrainReadiness` | **Internalize as the organic *gate*; retire its score from any display.** | Keep the boolean `ready` for generation gating (don't break run-full). Mark its numeric `score` as **never user-facing**. Long term, collapse into `getStrategyCapabilities.contentStrategy` (identical 5-field check) so there's one definition — but that consolidation is a *later* PR, not PX-2B. |
| `getBrandCompleteness` | **Rename + re-scope.** | It returns maturity, not completeness — the name is the bug. Rename to `getBrandMaturityScore` (truthful) for the `/brand` chip, and add a derived `getSetupCompleteness()` that reads `breakdown.completeness` for the real Setup layer. No behavior change to the number shown; just stop *calling* maturity "completeness." |
| `scoreBrandReadiness` | **Retire the percentage; internalize to a label.** | Stop emitting "Brand memory X%" from a second formula. The dashboard "Brand memory" signal should read maturity `status`/level (via `getBrandReadinessCopy`), not a divergent %. Removing the number is the single highest-value fix. **Note:** it also folds AI-inferred `aiInsights` into the score — see anti-confusion rule. |

---

## 5. Surface-by-Surface Display Rules

### `/brand` (the home of the model)
- **Headline:** maturity **stage label** ("ذاكرة العلامة: مبكرة / Brand Memory: Early"); the `XX/100` stays muted beside it with the existing "Why Early at 100%?" disclosure. (Already shipped — just stop sourcing it via a function named "completeness.")
- **Three layers visible:** Setup state (essentials filled / N remaining), Memory stage, Capability list — exactly the PX-2A "Brand Memory" cards + readiness panel.
- **One number max** (the maturity number, muted). Score History remains the only place a trend number is appropriate.

### `/dashboard`
- **Do NOT show a brand percentage.** Replace the `scoreBrandReadiness` "Brand memory X%" signal with the **same maturity label** `/brand` shows (via `getBrandReadinessCopy`) — e.g. "Brand memory: Developing."
- **Prefer next action over score.** The Operating Brief should lead with the next best action (complete essentials → create first strategy → …), with the maturity label as supporting context, not a competing metric.
- **Identical label to `/brand`.** Dashboard and `/brand` must render the same word for the same state, always.

### `/strategy`
- **When Brand Brain is incomplete (organic not ready):** show "ذاكرة العلامة: تحتاج بيانات أساسية" with the *specific* missing essentials (from capabilities `missingKeys`), linking to `/brand`. Never a bare "needs data."
- **When enough for organic but not full/paid:** show capability-accurate copy — "العضوي: جاهز لموجز أولي · الكامل: يحتاج معلومات إضافية · المدفوع: للتخطيط فقط" — sourced from `getStrategyCapabilities`, so it can never contradict `/brand`.
- **Resolve the "needs data" vs "organic ready" conflict** by sourcing BOTH pages from `getStrategyCapabilities.contentStrategy.ready`. If `/brand` says organic-ready, `/strategy` shows organic-ready — same function, no drift.

### `/content` and creative briefs
- **Do not show a readiness score/label here.** Showing readiness inside content surfaces invites the "is my brand good enough" anxiety mid-task.
- **Show "built from Brand Brain" evidence instead** — a quiet line naming which brand inputs shaped the output (audience, offer, tone), and, when relevant, which inputs were assumed/missing. This is the operator-memory payoff and is the natural home for the *provenance* work (postponed — see §9). For PX-2B: at most a static "Generated using your Brand Brain" attribution, no scores.

---

## 6. Arabic / English Readiness Language

Neutral MSA, Middle-East-friendly, consistent with PX-1/PX-2A. Use "ذاكرة العلامة التجارية" for Brand Brain and "رصيد" if credits ever appear.

| State | Arabic (MSA) | English |
|---|---|---|
| Setup not started | لم يبدأ الإعداد بعد | Setup not started |
| Setup in progress | الإعداد قيد التقدّم | Setup in progress |
| Setup complete | الإعداد الأساسي مكتمل | Essentials complete |
| Memory early | الذاكرة مبكرة | Memory early |
| Memory developing | الذاكرة قيد التطوّر | Memory developing |
| Memory strong | الذاكرة قويّة | Memory strong |
| Organic initial brief ready | العضوي: جاهز لموجز أوّلي | Organic: ready for an initial brief |
| Full strategy needs more data | الاستراتيجية الكاملة: تحتاج معلومات إضافية | Full strategy: needs more information |
| Paid planning-only | الإعلانات المدفوعة: للتخطيط فقط | Paid ads: planning-only |
| Auto-publishing not enabled | النشر التلقائي: غير مفعّل | Auto-publishing: not enabled |
| Analytics not connected | التحليلات: غير متصلة | Analytics: not connected |
| Learning memory early | ذاكرة التعلّم: مبكرة | Learning memory: early |

Supporting microcopy (reuse the shipped disclosure):
- Why-label, AR: «النضج يقيس عمق الذاكرة طويلة المدى، لا اكتمال الإعداد.»
- Why-label, EN: "Maturity measures long-term memory depth, not setup completeness."

---

## 7. Anti-Confusion Rules (the contract)

1. **One number rule.** Only the maturity score may ever appear as a number, and only muted beside its stage label. No surface renders a second brand percentage. *(Retires `scoreBrandReadiness` %.)*
2. **Never "100%" beside "Early" without the explanation.** Keep the "Why Early at 100%?" disclosure wherever any completeness signal and the maturity stage co-appear.
3. **Never name maturity "completeness."** *(Renames `getBrandCompleteness`.)* Setup completeness and Memory maturity are different layers with different words.
4. **"Ready" is never standalone.** Always "ready for *what*" (organic initial brief / not full / paid planning-only). Capability words come only from `getStrategyCapabilities`.
5. **Dashboard never contradicts `/brand`.** Same maturity label, same capability states, same source functions. If they can differ, it's a bug.
6. **AI-inferred ≠ confirmed.** `aiInsights` (AI-generated) must not raise a user-facing readiness signal as if it were confirmed brand memory. *(It currently nudges `scoreBrandReadiness`; retiring that % removes the issue. Until provenance exists, inferred data must never silently count as "known.")*
7. **Brand fields never imply paid/publishing/analytics readiness.** Paid = planning-only, auto-publish = not enabled, analytics = not connected are **fixed honest postures** driven by real connection/feature state, never inferred from how complete the brand profile is.
8. **Gate ≠ score.** `getBrandBrainReadiness` decides *can we generate*; it never tells the user *how mature* they are.

---

## 8. Recommended PX-2B Implementation Scope

**A label/derivation alignment PR — not a refactor of the math, not a schema change.** In priority order:

1. **Retire the dashboard brand percentage.** Replace the `scoreBrandReadiness` "Brand memory %" signal with the maturity label via `getBrandReadinessCopy`. (Highest-value, self-contained, dashboard-display only — but note: the task's guardrails say "do not touch dashboard," so this specific step may need explicit approval or be split into its own gated PR. Flag for decision before touching `/dashboard`.)
2. **Rename `getBrandCompleteness` → `getBrandMaturityScore`** and add a pure `getSetupCompleteness()` derived from `breakdown.completeness`. `/brand` chip number unchanged; only the name and the Setup-layer wording become truthful.
3. **Point `/strategy` brand state at `getStrategyCapabilities`** so "organic ready / needs data" can never disagree with `/brand`.
4. **Copy alignment** to the §6 label table across `/brand` and `/strategy` (and `/dashboard` if step 1 is approved).
5. **Tests** for the derivation helpers (pure functions), confirming one number, consistent labels.

**It should NOT:**
- Change any scoring math or thresholds (maturity formula stays byte-identical).
- Add/modify schema, migrations, or `aiInsights` semantics.
- Touch generation logic (`run-full`, content, briefs) beyond reading the same capability function.
- Persist provenance, broaden learning triggers, or add new capabilities.
- Introduce any new number or score.

**Scope-vs-guardrail note:** the cleanest unification touches `/dashboard` (step 1) and `/strategy` (step 3). The PX-2B *study* brief forbids touching dashboard. So the implementation should likely be **two PRs**: (a) `/brand` rename + Setup derivation + `/strategy` alignment (in-scope), and (b) a separately-approved dashboard-alignment PR to retire the % . Recommend confirming this split before implementation.

---

## 9. What to Explicitly Postpone

- **Per-field provenance persistence** (source: user / inferred / learned; confidence; date). This is the real fix for "What needs confirmation" and "built from Brand Brain" — but it's a schema + write-path change, out of a label-alignment PR. Postpone to a dedicated PX-2C/PX-3.
- **Collapsing `getBrandBrainReadiness` into `getStrategyCapabilities`.** Desirable (one organic definition) but touches 8 consumers incl. generation gating — do it as its own carefully-tested refactor, not inside a copy PR.
- **Broadening learning triggers** (edits/rejections) — separate learning-loop study.
- **Content/brief provenance evidence UI** — depends on provenance persistence above.
- **Any merge of analytics/PULSE signals** into the model — out of scope and forbidden.

---

## 10. Risks & Open Questions

**Risks**
- **Dashboard guardrail conflict (P1 for planning):** the most impactful unification step (retire the % ) lands on `/dashboard`, which this brief says not to touch. If left undone, the core P1 (conflicting numbers) is *not* fully resolved by an in-scope-only PR. Must be decided.
- **Renaming `getBrandCompleteness`** touches its `/brand` import; low risk but must keep the displayed number identical to avoid a perceived regression.
- **`/strategy` re-sourcing** could change the exact wording users see; ensure the capability labels match the shipped PX-2A panel verbatim to avoid a new inconsistency.
- **Score History** legitimately shows a maturity number trend — confirm the "no headline number" rule doesn't break that surface (it shouldn't; trend ≠ headline).

**Open questions for product**
1. **Headline:** confirm Memory stage (B) is the single headline, with Setup (A) and Capabilities (C) as detail — or does the dashboard want Capability/next-action as its headline instead of a brand label?
2. **Dashboard scope:** approve retiring the `scoreBrandReadiness` % now (separate gated PR), or defer and accept the residual cross-surface number mismatch until then?
3. **Setup completeness expression:** show it as a small "N essentials left" state only, or also a quiet "essentials X/8" — without it reading as a second score?
4. **`getBrandBrainReadiness` future:** agree it becomes an internal gate now and is folded into `getStrategyCapabilities` in a later refactor?
5. **`aiInsights`:** until provenance exists, should inferred insights be excluded from *every* readiness signal (recommended), even though they may genuinely help generation?

**Bottom line:** the unification is mostly *subtraction* — remove the second percentage, stop mis-naming maturity as completeness, and make every surface read from `calculateBrandMaturity` (depth), `getStrategyCapabilities` (capability), and `getBrandReadinessCopy` (words). One spine, three honest layers, one label — no new math, no schema.
