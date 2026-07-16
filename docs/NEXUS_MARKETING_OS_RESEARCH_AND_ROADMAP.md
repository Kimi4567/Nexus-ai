# NEXUS Marketing OS — research, operating model, and execution roadmap

**Status:** Product and engineering source of truth for the transformation from an AI marketing tool into an approval-led, continuously learning marketing operating system.

**Research date:** 12 July 2026

**Scope note:** This is a representative market study of the operating models that materially shape the category. It does not claim to enumerate every marketing company in the world. Product claims below are tied to first-party or industry sources; vendor performance claims are treated as vendor claims, not independent proof.

## 1. Executive decision

NEXUS should not compete as another prompt box or content generator. It should own one closed operating loop:

`Brand Brain → diagnosis → strategy → production → review → approval → scheduling/publishing → measurement → evidence-backed learning → next decision`

The user supplies and verifies the business truth, chooses a strategic direction, approves material decisions, and can stop or override any execution. NEXUS does the preparation, coordination, monitoring, and recommended next action.

The moat is not the number of agents. It is:

1. one governed source of brand and business truth;
2. a durable, inspectable workflow instead of disconnected generations;
3. real channel execution with approval gates;
4. measurement that separates observed facts from modelled estimates;
5. learning with provenance, confidence, and reversibility.

## 2. What the market actually does

### 2.1 AI-native marketing platforms

| Company / product | Actual operating pattern | What NEXUS should learn | What NEXUS should avoid |
|---|---|---|---|
| [Jasper](https://www.jasper.ai/platform) | A shared intelligence/governance layer (brand, audience, style, knowledge) feeds agents and repeatable content pipelines. Humans orchestrate and govern the workflow. | Treat Brand Brain as an execution dependency with governance, not a profile page. Reusable pipelines matter more than isolated tools. | A library of agents with inconsistent context or no measurable workflow outcome. |
| [HubSpot Breeze](https://www.hubspot.com/products/artificial-intelligence/use-cases/plan-campaigns) | A brief becomes a multichannel plan; CRM context informs the audience; assets are remixed per channel; teams review in a shared campaign workspace. | Connect customer/business data to planning, then turn one approved message into channel-native assets. | Starting content production before the objective, audience, and conversion path are explicit. |
| [WPP Open](https://www.wpp.com/en/open) | Strategy, creative, media, and production are connected through shared intelligence and coordinated agents, with humans at the helm and governance around brand safety. | The product architecture must span the full value chain and show the user why a recommendation exists. | Claiming autonomy where integrations, approvals, data rights, or measurement do not support it. |
| [Omneky](https://www.omneky.com/campaign-launcher) | Brand and performance data feed a creative brief, creative variations, review/approval, cross-channel launch, and unified analytics. | Make “brief → approve → launch → learn” a single visible workflow. | Generating volume without fatigue controls, experiment design, or channel-specific compliance. |
| [Smartly](https://www.smartly.io/) | Creative, media, and intelligence are brought into one advertising workflow for scaled production and optimization. | Creative and media decisions must share the same performance evidence. | Separate creative analytics and budget optimization systems that cannot explain each other. |
| [Albert](https://albert.ai/faq/) | Autonomous optimization acts inside advertiser-defined objectives and guardrails, reallocating budget and adjusting bids continuously. | Automation levels and guardrails must be explicit. Low-risk actions can be automated; money-moving actions require stricter policy. | “24/7” as a decorative claim. It requires live data, job health, guardrails, audit logs, and incident handling. |
| [Madgicx](https://madgicx.com/optimization) | Daily account audits surface actions; users can apply optimization recommendations, while automation focuses heavily on Meta ads. | A daily decision queue is a strong product surface: issue, evidence, action, expected trade-off, approval. | Pretending one platform-specific optimizer is a complete marketing department. |
| [AdCreative.ai](https://help.adcreative.ai/en/articles/8885776-what-is-creative-scoring-ai-and-how-to-use-it) | Creative variants are scored and ranked; connected account data improves recommendations. | Pre-flight checks can rank variants, but must be labelled predictions until real results arrive. | Presenting a predictive score as a guaranteed result. |

### 2.2 Human agency operating model

Strong agencies do not begin with deliverables. They begin by reducing ambiguity.

The practical agency loop is:

1. **Commercial intake and fit:** clarify business problem, desired outcome, budget range, decision-makers, data access, timing, constraints, and scope. The [4As](https://www.aaaa.org/blog/ana-and-4as-10-principles-of-pitching/) emphasizes a detailed brief, business outcomes, KPIs, transparency, and decision-maker alignment.
2. **Discovery and diagnosis:** category, customer, competitor, brand, funnel, product economics, historical performance, tracking quality, and constraints.
3. **Strategy:** choose the growth problem, target, positioning, message, channel roles, budget posture, and measurement design.
4. **Creative brief:** translate strategy into one clear problem for creative work, with objective, audience, budget, proposition, evidence, mandatory elements, and success criteria. Research summarized by the [IPA BetterBriefs project](https://ipa.co.uk/news/betterbriefs) shows how expensive unclear briefs are.
5. **Production:** concepts, copy, design, adaptations, QA, legal/compliance, and asset trafficking.
6. **Media and activation:** channel configuration, targeting, budget, tracking, naming, QA, approvals, launch, and pacing.
7. **Account management:** status, dependencies, decisions, scope, budget, risk, and stakeholder communication.
8. **Measurement and learning:** reporting, diagnosis, experiments, optimization, and after-action review. The IPA recommends a learning agenda and a combination of modelling, experiments, simulation, and implementation rather than one “perfect” attribution method ([Making Effectiveness Work](https://ipa.co.uk/knowledge/publications-reports/making-effectiveness-work)).

NEXUS must encode this discipline. The AI is not the strategy; it is the system that makes disciplined marketing accessible and repeatable.

## 3. Marketing principles NEXUS will encode

1. **Balance demand creation and demand capture.** Short-term activation alone can improve visible efficiency while weakening future demand. Binet and Field’s IPA work calls for integrating brand and activation and measuring short- and long-term effects ([The Long and the Short of It](https://ipa.co.uk/knowledge/documents/the-long-and-the-short-of-it-presentation)). The split is a planning prior, never a universal fixed percentage.
2. **Build mental and physical availability.** Growth requires being easy to think of and easy to buy. Distinctive assets should be measured for fame and uniqueness and developed consistently ([Ehrenberg-Bass Institute](https://marketingscience.info/learn-with-us/commercial-research/distinctive-asset)).
3. **Broad reach and category entry points matter.** NEXUS should capture buying situations, triggers, and category needs in Brand Brain, not only personas.
4. **One brief, one primary job.** A campaign can support several metrics, but the operating brief needs one primary business outcome and explicit secondary diagnostics.
5. **Creative quality and media work together.** The system should learn at message, hook, format, audience, channel, and offer levels—not store a post as one undifferentiated winner.
6. **Measurement needs multiple methods.** Platform attribution is useful operationally but is not automatically causal. Where data volume permits, use experiments and marketing-mix modelling. Google’s [Meridian](https://developers.google.com/meridian) is an example of privacy-durable MMM with experiment calibration and budget optimization.
7. **Consistency is an asset.** Do not change distinctive brand elements merely because the team is bored. Require evidence for changes.
8. **Learning must be evidence-weighted.** A user approval is a preference signal. Publishing is an execution fact. Engagement is an observed platform signal. Conversion and revenue are business outcomes. Incrementality is causal evidence. These must never be collapsed into one “winning” label.
9. **Holistic measurement is still rare.** Nielsen reports that only 32% of surveyed global marketers measured traditional and digital media holistically in its 2025 study ([Annual Marketing Report](https://www.nielsen.com/insights/2025/annual-marketing-report-2025-chaos-to-clarity/)). NEXUS should make measurement quality and blind spots visible.
10. **Automation needs guardrails.** The system may recommend a pause, scale, rewrite, or channel change. It must show evidence, confidence, risk, and the approval policy before execution.

## 4. Product operating model

### 4.1 The ten stages

1. **Connect:** website, analytics, CRM/conversion destination, social accounts, ad accounts, product catalogue, and media library.
2. **Build Brand Brain:** capture verified truth and import evidence.
3. **Diagnose:** summarize market, customer, funnel, measurement health, content supply, and risks.
4. **Choose outcome:** awareness, demand, leads, sales, retention, launch, or another explicit job.
5. **Create strategy:** organic, paid planning, or full; horizon, intensity, budget posture, and measurement plan.
6. **Approve strategy:** the user approves scope, assumptions, cost, risks, and success definition.
7. **Produce:** content calendar, captions, scripts, briefs, variants, landing/email/ad copy, and channel adaptations.
8. **Review and approve:** Sentinel checks brand, claims, policy, accessibility, tracking, and readiness. The user approves by batch or exception.
9. **Execute and monitor:** schedule/publish where connected, monitor delivery and performance, create an action queue, and never spend or publish outside policy.
10. **Learn and evolve:** store evidence, propose Brand Brain updates, compare against baselines, and require review for identity or strategic changes.

### 4.2 Automation levels

| Level | Behaviour | Default examples |
|---|---|---|
| Observe | Read and report only | health checks, anomaly detection, missing tracking |
| Recommend | Produce an evidence-backed action | rewrite, pause suggestion, budget reallocation proposal |
| Prepare | Build the change but do not execute | draft post, campaign config, revised budget, experiment |
| Approve-to-run | One user approval executes a bounded action | publish approved post, activate approved campaign |
| Policy autopilot | Execute pre-authorized low-risk rules, with audit and rollback | retry failed publishing, reschedule inside an approved window |

Budget increases, new campaign launches, destructive pauses, legal claims, and Brand Brain identity changes should not be autonomous by default.

## 5. Brand Brain v3 contract

The current `BrandProfile` is a useful base, but the final Brand Brain needs five governed layers.

### A. Verified business truth

- brand/company identity, markets, languages, products/services, availability;
- commercial model, price bands, margins/AOV/LTV bands, sales cycle, capacity;
- conversion destinations, lead handling, fulfilment constraints;
- legal, regulated claims, prohibited claims, mandatory disclaimers;
- user-verified evidence and proof.

### B. Market and customer model

- category and alternatives;
- ICP/segments plus jobs, triggers, pains, desires, objections;
- category entry points / buying situations;
- competitor set, parity points, differentiation hypotheses;
- customer journey and funnel friction.

### C. Brand system

- positioning, value proposition, message hierarchy;
- voice, writing style, avoid list, examples;
- distinctive assets: logo, colors, type, shapes, characters, sonic assets;
- visual rules and asset usage;
- channel and localization rules.

### D. Growth and measurement model

- primary business outcomes and KPI tree;
- baseline, target, timeframe, source, and confidence for every KPI;
- channel roles across paid/earned/shared/owned;
- budget guardrails and test budget;
- tracking readiness, attribution limitations, and experiment backlog.

### E. Evidence-backed memory

Every learned item needs:

- `sourceType`: user, import, approval, edit, platform metric, conversion, experiment, model inference;
- `sourceId` and timestamp;
- `confidence` and sample size;
- scope: brand, segment, channel, format, campaign, market;
- status: proposed, accepted, active, contradicted, retired;
- effective version and rollback history;
- observation text and recommended implication kept separately.

**Non-negotiable rule:** model inference can propose Brand Brain changes; it cannot silently turn assumptions into verified brand truth.

## 6. Learning hierarchy

| Signal | What it proves | Allowed automatic effect |
|---|---|---|
| Content generated | Work exists | none |
| Content approved | User preference / brand fit | improve style preference with medium confidence |
| Variant rejected or edited | Negative preference and correction | propose a local rule; do not generalize after one sample |
| Published | Execution completed | update operational history only |
| Engagement above a valid baseline | Audience response on a platform | propose hook/format/channel learning scoped to that platform |
| Qualified lead / sale | Down-funnel outcome | increase confidence in audience/offer/message combination |
| Controlled experiment / incrementality | Causal lift within test conditions | eligible for budget/strategy policy updates |

The existing daily monitor that treats every published post as a winning pattern violates this hierarchy and must be removed. The analytics feedback loop can promote a pattern only after a valid comparison and minimum evidence threshold.

## 7. Commercial model

The public pricing surface should show exactly **two paid subscriptions**. The 14-day/15-credit trial is onboarding, not a third plan. It funds one bounded activation journey: Organic Light strategy plus quality review; Content Hub production remains paid scope.

### Growth — $49/month

- 150 monthly credits;
- up to 3 brand workspaces;
- 25 planned posts/month and 10 campaign workflows/month;
- full Brand Brain, strategy, production, approvals, scheduling, learning, and core analytics;
- designed for a founder or small team operating its own brands.

### Autopilot — $99/month

- 500 monthly credits;
- up to 10 brands/workspaces;
- 60 planned posts/month and high campaign allowance;
- always-on monitoring/action queue, advanced paid planning, multi-account operations as integrations allow, white-label reporting, and higher support priority;
- designed for multi-brand operators and small agencies.

### Credit packs

- 100 credits — $29;
- 300 credits — $69;
- purchased credits expire after 12 months and survive subscription renewal/cancellation;
- monthly credits are consumed before longer-lived purchased credits when they expire sooner;
- packs are one-time Stripe payments and are fulfilled only by a verified, idempotent webhook.

The current image path uses `gpt-image-1` high quality. Official pricing lists high-quality output at $0.167 for 1024×1024 and $0.25 for 1024×1536 / 1536×1024, materially above the older estimates in code ([official model pricing](https://developers.openai.com/api/docs/models/gpt-image-1)). Until a model/quality migration is visually validated, plan economics must assume the higher cost and enforce post/image caps.

## 8. Architecture decisions

1. Keep the lean Next.js + Prisma + Supabase + Vercel architecture in phase 1.
2. Use PostgreSQL as the durable workflow and audit source of truth.
3. Centralize Brand Brain prompt context in one typed builder. Routes must not each invent their own subset.
4. Store campaign strategy, content, approvals, executions, metrics, and learning as linked records with immutable event history.
5. Keep every mutation idempotent, especially webhooks, publishing, AI retries, and credit fulfilment.
6. Use scheduled Vercel jobs only for bounded work. Add a queue/worker when runtime or volume crosses safe limits.
7. Separate three numbers: available credits, monthly allowance, and purchased/bonus balances.
8. Make operational truth visible: last successful sync, data freshness, monitoring coverage, and blockers.
9. Do not expose new Supabase public-schema tables through the Data API unless required. If exposed, grant explicitly and enable RLS; Supabase changed new-table exposure defaults in April 2026 ([changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)).

## 9. Delivery roadmap

### Phase 0 — truth and stability (now)

- remove false learning from publication-only events;
- consolidate two paid plans and make feature claims honest;
- finish grant-ledger renewal/cancellation semantics before selling credit packs;
- verify Stripe webhook idempotency and wallet reconciliation;
- centralize commercial constants;
- establish product truth tests for claims, status, and readiness.

### Phase 1 — Brand Brain as the spine

- add provenance/versioning and the five-layer Brand Brain contract;
- create a single typed context builder used by strategy, content, paid, chat, and visuals;
- show confirmed facts, assumptions, missing data, and learning proposals separately;
- improve onboarding around business outcome, offer, customer, conversion path, and measurement.

### Phase 2 — marketing workflow

- create an Operating Brief and strategy approval state machine;
- generate deterministic deliverables from approved scope;
- add batch review/approval, claims QA, policy checks, and content provenance;
- unify calendar, campaign, and content status into one execution truth.

### Phase 3 — channel execution

- harden Meta/LinkedIn publishing and metrics;
- add Google/TikTok only after app/API approval and end-to-end tests;
- introduce launch checklists, tracking validation, and rollback/incident status;
- create the 24/7 action queue with evidence and explicit approval policies.

### Phase 4 — performance intelligence

- metric normalization and data freshness;
- baselines, anomaly detection, creative fatigue, pacing, and funnel diagnosis;
- experiment design and learning agenda;
- eventually MMM/incrementality when a workspace has sufficient history and spend.

### Phase 5 — scale and enterprise

- durable queue/workers, concurrency control, job observability, and cost budgets;
- permissions, multi-brand governance, template/policy libraries, SLA and audit exports;
- data retention, regional/privacy controls, and enterprise integrations.

## 10. Definition of “24/7 marketing company”

NEXUS may use this positioning only when the product can prove:

- scheduled monitors are healthy and observable;
- integrations are connected and their data is fresh;
- failures create alerts and retry safely;
- every action has a policy, audit record, and rollback path;
- recommendations show evidence and confidence;
- publishing/spend never exceeds approved scope;
- the system learns from outcomes, not from its own generated text;
- a user can understand “what is happening now, why, and what needs approval” from the dashboard.

Until then, the honest product language is: **NEXUS continuously monitors connected marketing activity and prepares evidence-backed actions for your approval.**
