# OP-D1 Status Contract Discovery

## Executive Verdict

The core operating mismatch is that NEXUS has several real lifecycle models, but the product surfaces do not consistently name the same state.

The database has a coarse `Campaign.status` (`DRAFT`, `ACTIVE`, `SCHEDULED`, etc.), a more precise `SocialPost.status` lifecycle (`DRAFT` -> `APPROVED` -> `SCHEDULED` -> `PUBLISHED`/`FAILED`), separate `publishMode` (`MANUAL`/`AUTO`), separate integration readiness, separate visual generation state, and separate paid planning/ad states. The UI often collapses those into broad words like Draft, Active, Live, Content, Schedule, Publish, or Autopilot.

Result: users can see a campaign with a generated strategy still labelled Draft, a calendar counting AI-planned items next to scheduled posts, a Content Hub saying no content while the calendar says campaigns have content, and publish controls before the campaign/content contract is clearly satisfied.

This is mostly a status-contract and presentation problem. Some backend gates are strong; the UI does not always make those gates obvious.

## Current Status Model Inventory

### Campaign

Source: `prisma/schema.prisma`

`Campaign.status`:

- `DRAFT`
- `SCHEDULED`
- `ACTIVE`
- `PAUSED`
- `COMPLETED`
- `ARCHIVED`

Important behavior:

- `src/app/api/campaigns/[id]/route.ts` allows setting `ACTIVE` only if `aiOutput.sentinelReview.status === 'passed'`.
- It does not require content plan posts to exist before `ACTIVE`.
- `src/app/api/autopilot/activate/route.ts` sets `Campaign.status = 'SCHEDULED'` and `autopilotEnabled = true` after generating autopilot scheduled posts.
- `/campaigns` summary counts `ACTIVE` as active and `DRAFT` as draft through `src/lib/campaignSummary.ts`.

### SocialPost / Content

Source: `prisma/schema.prisma`, `src/lib/postStatus.ts`, `src/lib/approvalPlan.ts`

`SocialPost.status`:

- `DRAFT`
- `APPROVED`
- `SCHEDULED`
- `PUBLISHED`
- `FAILED`

Canonical helper lifecycle:

- `DRAFT -> APPROVED -> SCHEDULED -> PUBLISHED | FAILED`
- Corrective transitions include unapprove/unschedule/reset paths.

Content plan specifics:

- `generationStatus`: string values used as `PENDING`, `GENERATING`, `DONE`, `FAILED`, `SKIPPED`, `AWAITING_UPLOAD`.
- `mediaSource`: `GENERATE`, `UPLOAD`, `MIXED`, `UPLOAD_RAW`.
- `contentPlanIndex`, `isVideoPost`, `videoPrompt`, `imagePrompt`, `imageUrl`, `uploadedMediaId`.

Important behavior:

- `src/app/api/campaigns/[id]/generate-content-plan/route.ts` creates `SocialPost` rows as `DRAFT`.
- `src/app/api/campaigns/[id]/approve-content-plan/route.ts` defaults to `DRAFT -> APPROVED` only. It does not schedule by default.
- `src/app/api/campaigns/[id]/schedule-content-plan/route.ts` moves only `APPROVED -> SCHEDULED`.
- `src/app/api/campaigns/[id]/content-plan/[postId]/manual-publish/route.ts` records a user hand-publish confirmation.

### Scheduling / Calendar

Sources:

- `src/app/calendar/page.tsx`
- `src/app/api/schedule/route.ts`
- `src/lib/contentCounts.ts`

Calendar data sources:

- AI planned strategy content from `Campaign.aiOutput.calendarItems`, `contentCalendar`, or legacy strategy calendar fields.
- Scheduled/published `SocialPost` records from `/api/schedule`.

`/api/schedule`:

- GET returns `SocialPost` rows with statuses in `SCHEDULED`, `DRAFT`, `PUBLISHED`, `FAILED`.
- POST creates a new `SocialPost` with `status = SCHEDULED`.
- DELETE removes a local scheduled/history row.

The helper `getPublishingStateSummary()` correctly separates:

- `draft`
- `approved`
- `scheduled`
- `published`
- `failed`
- `notScheduled`
- `platforms`

### Publish Mode

Source: `prisma/schema.prisma`, `src/lib/publishGate.ts`

`PublishMode`:

- `MANUAL`
- `AUTO`

Important behavior:

- Default is `MANUAL`.
- `src/lib/publishGate.ts` allows cron auto-publishing only when `status === 'SCHEDULED'`, `publishMode === 'AUTO'`, and `scheduledAt` is due.
- Manual/legacy scheduled posts are explicitly skipped by the cron auto-publish gate.

### Platform Readiness

Source: `src/lib/platformReadiness.ts`

Readiness statuses:

- `ready`
- `needs_setup`
- `not_connected`
- `permission_unverified`
- `planning_only`
- `not_available`

Important behavior:

- Facebook is the only platform allowed to reach `ready`, and only with a connected page.
- Instagram, TikTok, and LinkedIn are capped at `permission_unverified`.
- Paid ads are always `planning_only`.
- Google, Snapchat, and WhatsApp are `not_available`.

### Paid Planning

Sources: `prisma/schema.prisma`, paid-pack/ad models

`PaidPackStatus`:

- `DRAFT`
- `GENERATED`
- `LAUNCHED`
- `COMPLETED`

Ad execution models:

- `AdAccountStatus`: `ACTIVE`, `DISCONNECTED`, `ERROR`, `PENDING`
- `AdCampaignStatus`: `DRAFT`, `PENDING_REVIEW`, `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED`, `REJECTED`
- `AdStatus`: `DRAFT`, `PENDING_REVIEW`, `ACTIVE`, `PAUSED`, `ARCHIVED`, `DISAPPROVED`, `COMPLETED`

Current product direction is good: paid planning copy repeatedly says planning only and no ad spend without approval. The contract still needs to distinguish paid-plan draft, launch review, platform review, and live ad states.

### Approval / Sentinel

Sources:

- `src/app/campaigns/[id]/page.tsx`
- `src/app/api/campaigns/[id]/route.ts`
- `src/app/api/campaigns/[id]/sentinel-review/route.ts`

Observed statuses:

- `not_reviewed`
- `passed`
- `needs_attention`

Campaign `ACTIVE` approval is gated on `sentinelReview.status === 'passed'`.

Important mismatch: `ACTIVE` here means strategy approval/campaign approval, not necessarily published, scheduled, or live.

### Performance / Analytics

Sources:

- `src/app/api/campaigns/[id]/performance/route.ts`
- `src/app/api/analytics/overview/route.ts`
- `src/app/api/analytics/insights/route.ts`
- `src/app/analytics/page.tsx`

Real metrics:

- Campaign counts from `Campaign`.
- Published post counts from `SocialPost.status = PUBLISHED`.
- Campaign performance from published posts with `analyticsData`.
- Visual count from completed `GeneratedVisual`.
- Credit usage from ledger helpers.

AI/PULSE analysis:

- The page can call `/api/ai/generate` from user prompts for forecasts, competitor analysis, trends, content, and performance.
- Rule-based `/api/analytics/insights` is grounded in DB state, but copy can still imply "ready to activate" or "active campaigns" using coarse `Campaign.status`.

## Surface-by-Surface Findings

### `/dashboard`

Current message:

- Early operating mode can label the next action as "Open the strategy workflow".
- Normal header CTA goes to `/strategy`.
- Intelligence and stats come from `/api/dashboard/stats`, `/api/campaigns`, and `/api/dashboard/intelligence`.

State relied on:

- Campaign counts/statuses.
- `intelligence.nextBestAction.href` and id.
- Brand maturity and publishing state.

Misleading or unclear:

- If a draft campaign with generated strategy exists, `/strategy` no longer behaves like the old strategy workflow selector. It becomes a read-only status/summary page.
- "Open strategy workflow" can overpromise a selector/generation flow when the actual state is "review an existing strategy/campaign draft".

Recommended correction:

- If a campaign/strategy exists: "Review draft strategy" or "Review campaign draft".
- If no strategy exists: "Create first strategy".
- If strategy exists but no content plan exists: "Generate content plan".
- Avoid "workflow" unless the selector/modal is actually opened.

### `/strategy`

Current message:

- Read-only strategy IA page.
- Loads `/api/campaigns?limit=5&sort=updatedAt` and `/api/brand`.
- If any campaign exists, `hasStrategy = total > 0`.
- Shows "Draft strategy available" when the recent campaign is `DRAFT`.
- Empty state CTA points to `/dashboard?runStrategy=1` to open the Run Full Strategy modal.

State relied on:

- Total campaign count, recent campaign `aiOutput`, brand maturity.

Misleading or unclear:

- It equates "has any campaign" with "has strategy", even though a campaign may exist without a meaningful generated strategy.
- The old selector for strategy type/duration/organic-paid-full/post details/credit preview appears to live in `RunFullStrategyModal`, reachable via `/dashboard?runStrategy=1`, not as the main `/strategy` surface once a campaign exists.
- There is no obvious "create another strategy" path on `/strategy` after a draft exists.

Recommended correction:

- Define `/strategy` as "Strategy overview" and show state-aware actions:
  - No strategy: "Create strategy".
  - Draft generated: "Review strategy".
  - Sentinel passed: "Approve strategy and build content plan".
  - Active strategy/no content: "Generate organic content plan".
- Keep a clear secondary "Create new strategy" entry if safe.

### `/campaigns`

Current message:

- Lists campaigns with `Campaign.status` badges.
- Summary cards show total, active, draft.

State relied on:

- `/api/campaigns` rows and counts.
- `Campaign.status` only.

Misleading or unclear:

- "Draft" covers many different realities:
  - empty campaign shell;
  - generated strategy;
  - awaiting Sentinel;
  - Sentinel passed but not approved;
  - content not generated.
- "Active" is counted from `Campaign.status === ACTIVE`, but this may mean approved strategy, not live campaign execution.

Recommended correction:

- Keep `Campaign.status` internally, but display a derived operating status:
  - Empty draft
  - Strategy generated
  - Awaiting review
  - Ready for content
  - Content draft
  - Scheduled
  - Live/published
- Rename summary card "Active" to "Approved campaigns" unless published/live proof exists.

### `/campaigns/[id]`

Current message:

- Proof of Work can say strategy created = done.
- Header badge shows raw `Campaign.status`.
- Stepper says Generate -> Review -> Approve -> Live.
- CTA can show Sentinel Review, Approve & Launch, or View Content Hub.
- Tabs expose Strategy, Content, Calendar, Visuals, Publish, Autopilot, Performance.

State relied on:

- `Campaign.status`.
- `aiOutput.strategy`, `sentinelReview`, `calendarItems`, content calendar fields.
- `socialPostCount`.
- Autopilot fields.

Misleading or unclear:

- "Draft" remains visible even after a strategy is generated.
- "Approve & Launch" sets `Campaign.status = ACTIVE` and may generate content plan, but does not necessarily publish or launch externally.
- "Live" step uses `autopilotEnabled` as done, not actual published content.
- Publish tab appears before content approval/scheduling state is clearly satisfied.
- Visuals tab can generate campaign-level visuals before a content item actually needs creative.

Recommended correction:

- Replace raw campaign badge with derived operating state.
- Rename "Approve & Launch" to "Approve strategy & build content plan" or "Approve and continue to Content Hub".
- Replace "Live" with "Execution" or split into "Scheduled" and "Published".
- Lock/readonly Publish tab until content exists, is approved/scheduled, and platform readiness is proven.

### `/content-hub`

Current message:

- Global campaign grid.
- For each campaign, loads `/api/campaigns/[id]/content-plan`.
- If no `SocialPost` rows, shows "No content yet" and "Click to generate content".
- If rows exist, it counts visual generation status: done/pending/failed.

State relied on:

- Content plan rows only.
- `generationStatus`, not post approval/scheduling lifecycle.

Misleading or unclear:

- "Content" here means `SocialPost` content plan rows, not strategy content ideas.
- Progress says "Visuals generated", which is good, but the global badge "Complete" can mean all visuals generated, not content approved or scheduled.
- It can contradict Calendar because Calendar may count AI-planned strategy items from `aiOutput`.

Recommended correction:

- Rename zero state to "No content plan generated yet".
- Use separate counts:
  - Strategy ideas exist
  - Draft posts
  - Approved posts
  - Scheduled posts
  - Visuals generated
- Do not say "Complete" unless content lifecycle is complete for the intended stage.

### `/campaigns/[id]/content-hub`

Current message:

- Shows monthly content plan rows.
- Header says drafts to review, image slots, video slots, visuals generated.
- Primary CTA: approve drafts, then schedule approved posts.
- Manual publish checklist exists for scheduled manual posts.

State relied on:

- `SocialPost.status`.
- `generationStatus`.
- planned `scheduledAt`.
- integration linkage.

Misleading or unclear:

- This page has the best real lifecycle contract, but some modals still say "Publishing window" and "Publishing to" even after approval-only steps.
- `scheduledAt` exists on draft/approved posts as a planned date; this can read like actual scheduling.
- Image generation and content approval share the same page priority, which can blur "content ready" vs "creative ready".

Recommended correction:

- Use explicit labels:
  - "Planned date" before scheduling.
  - "Scheduled date" after `status=SCHEDULED`.
  - "Connected account ready" only when integration/page exists.
- Keep approval and scheduling as separate primary steps.

### `/calendar`

Current message:

- Tabs: Strategy Timeline and Publishing Queue.
- Timeline says "Your AI-planned content pipeline across all campaigns."
- It overlays AI planned posts, scheduled posts, and published posts.
- Stats say "Posts this month", "Campaigns this month", "Platforms".
- Empty state can say "No posts scheduled for this month. You have X campaigns with content — approved content isn't scheduled yet."

State relied on:

- `Campaign.aiOutput` calendar fields.
- `/api/schedule` `SocialPost` rows.
- Derived queue counts from `getPublishingStateSummary()`.

Misleading or unclear:

- "Posts this month" mixes strategy-planned posts with actual scheduled/published posts.
- The empty-state phrase "campaigns with content" can refer to campaigns with strategy-planned content, not necessarily generated `SocialPost` content.
- Auto-jump banner says "where your scheduled content landed" even if source is AI planned strategy content.

Recommended correction:

- Rename timeline metric to "Planned items this month".
- Add separate metrics for "Scheduled posts" and "Published posts".
- Use labels:
  - "Planned by strategy"
  - "Scheduled for publishing"
  - "Published"
- Only use "scheduled" for `SocialPost.status === SCHEDULED`.

### `/connections`

Current message:

- Header/subtitle and platform feature cards imply connection enables publish, schedule, and analyze.
- Platform readiness panel uses `derivePlatformReadiness()` and is conservative.

State relied on:

- `/api/social/accounts`.
- Readiness helper.

Misleading or unclear:

- Feature lists for TikTok/LinkedIn/Meta can overstate platform support compared with readiness helper caps.
- "Connect platforms so NEXUS can publish, schedule, and analyze performance automatically" should be qualified.

Recommended correction:

- Use "where supported, after approval, and when permissions are verified."
- Surface per-platform capability matrix:
  - connect
  - schedule
  - publish
  - analytics
  - ads
- Keep readiness helper as the source of truth.

### `/analytics`

Current message:

- PULSE dashboard with real overview cards and AI analysis tabs.
- Rule-based system insights from `/api/analytics/insights`.
- AI prompt generation can produce forecasts/competitor/trend analysis.

State relied on:

- `/api/analytics/overview` real DB counts.
- `/api/analytics/insights` rule-based DB state.
- `/api/ai/generate` for user-triggered analysis.

Misleading or unclear:

- Forecast/competitor/trend tabs can sound authoritative even when there is little or no published data.
- Insights can say draft campaigns are "ready to activate" based only on coarse `Campaign.status`.
- "Active campaigns" means `Campaign.status=ACTIVE`, not necessarily live publishing.

Recommended correction:

- Add data confidence labels:
  - "No published posts yet"
  - "Based on Brand Brain and campaign setup, not live performance"
  - "Forecast requires published content and analytics to become reliable"
- Rename `activeCampaigns` display to "Approved campaigns" unless there is published proof.

## Proposed Canonical Operating Contract

### Campaign

- `Draft`: campaign shell exists, no generated strategy yet.
- `Strategy generated`: AI strategy exists, not yet reviewed.
- `Awaiting strategy review`: strategy exists and Sentinel has not passed.
- `Ready for content`: Sentinel passed or strategy approved; content plan not generated.
- `Content in progress`: content plan exists with draft posts or pending visual generation.
- `Awaiting approval`: content draft exists and needs user approval.
- `Approved`: strategy/content approved, but not scheduled.
- `Scheduled`: posts have `SocialPost.status=SCHEDULED`.
- `Live/Active`: at least one post is actually published, or a paid ad campaign is live. Do not use this for strategy approval only.
- `Completed/Archived`: campaign intentionally closed or archived.

### Content

- `Idea / planned by strategy`: exists only in `Campaign.aiOutput`, not a `SocialPost`.
- `Draft`: `SocialPost.status=DRAFT`.
- `Needs review`: draft post awaiting user approval.
- `Needs creative`: post lacks required `imageUrl` or has pending/failed `generationStatus`.
- `Approved`: `SocialPost.status=APPROVED`.
- `Scheduled manual`: `SocialPost.status=SCHEDULED` and `publishMode=MANUAL`.
- `Scheduled auto`: `SocialPost.status=SCHEDULED` and `publishMode=AUTO`.
- `Published`: `SocialPost.status=PUBLISHED`, with manual/auto distinction derived from `publishMode` and platform proof.
- `Failed`: `SocialPost.status=FAILED` or `generationStatus=FAILED`.
- `Needs attention`: invalid combination, missing integration, missing creative, failed publish, or policy/safety issue.

### Calendar

- `Planned by strategy`: `Campaign.aiOutput` calendar item only.
- `Ready to schedule`: approved post with planned date but not `SCHEDULED`.
- `Scheduled for manual publishing`: `SCHEDULED + MANUAL`.
- `Scheduled for auto publishing`: `SCHEDULED + AUTO`.
- `Published`: `PUBLISHED`.
- `Failed`: `FAILED`.

### Publishing

- `Not ready`: no approved/scheduled content or no platform readiness.
- `Manual publish required`: scheduled manual post.
- `Auto-ready`: scheduled auto post with connected/verified integration.
- `Scheduled`: has `SocialPost.status=SCHEDULED`.
- `Published`: platform or manual confirmation exists.
- `Failed`: publish API or manual confirmation failed.

### Paid

- `Planning only`: strategy/paid pack exists, no ad account/budget approval.
- `Needs budget`: paid pack missing explicit budget.
- `Needs ad account`: no valid `AdAccount`/platform readiness.
- `Needs approval`: budget/account/creative exists but user has not approved launch.
- `Ready for launch review`: launch package ready, no spend yet.
- `Launched`: platform campaign/ad is actually active.
- `Paused/Completed`: campaign ended or stopped.

## First Recommended PR Sequence

1. OP-D1.1 Dashboard/Strategy CTA state correction.
   - Make dashboard next action distinguish "Create strategy", "Review draft strategy", "Generate content plan", and "Open campaign draft".
   - Update `/strategy` copy so it does not promise the old workflow selector when a campaign already exists.

2. OP-D1.2 Calendar planned vs scheduled copy/count correction.
   - Rename mixed counts.
   - Separate AI-planned items from scheduled/published `SocialPost` rows.
   - Fix empty-state wording that says campaigns have content when only strategy ideas exist.

3. OP-D1.3 Publish tab locked-state honesty.
   - Keep backend behavior untouched at first.
   - Add read-only/locked UI states until campaign/content/platform gates are met.
   - Make direct publish controls explicit as manual/direct publishing, not campaign lifecycle publish.

4. CH-D1 Content Hub operating queue.
   - Promote the `SocialPost` lifecycle as the primary operating queue.
   - Split draft/approved/scheduled/published/failed/needs creative.

5. CS-D1 Creative Studio Lite post-level study.
   - Move from campaign-level visual generation toward post/content-item-level creative readiness.

## Design Discipline Findings

- Campaign detail is visually heavy and action-dense; tabs expose too many future-stage controls early.
- Dark campaign detail styling makes status chips feel dramatic even when state is ordinary draft/review.
- Too many tabs/actions appear before the user has earned the next state.
- Status colors are not consistently tied to the same lifecycle across surfaces.
- Cards often mix planning, execution, and performance in one visual hierarchy.
- Calendar is conceptually improved with two tabs, but the timeline stats still mix planned and scheduled concepts.
- Publish and Visuals need stronger locked/readonly states, not just backend error handling.

## Risks

### User Trust Risk

Users may believe NEXUS lost content, skipped a step, or contradicted itself when different pages call different things "content", "draft", "active", or "scheduled".

### Publishing Safety Risk

The backend has good cron gates, but the campaign detail Publish tab exposes direct publish controls before the full campaign/content approval story is clear. Users may think campaign approval and publish readiness are the same thing.

### Paid Ads Safety Risk

Paid planning copy is mostly conservative, but any use of "launch" near campaign approval can imply spend readiness. Paid should remain planning/review until explicit account, budget, creative, and approval gates are shown.

### Credit Risk

Autopilot activation and content/image generation can spend credits. Buttons exposed too early can feel like navigation while actually triggering generation/spend paths.

### Analytics Hallucination Risk

PULSE AI analysis can generate forecasts/competitor/trend output even when no published performance data exists. This should be confidence-labelled as advisory, not performance-grounded.

## What Must Not Change Yet

- Do not change schemas or migrations.
- Do not change publishing cron or platform API logic.
- Do not change `SocialPost` lifecycle helpers.
- Do not change credit deduction, refunds, billing, wallet, or grants.
- Do not change paid ads launch logic.
- Do not change analytics/PULSE generation behavior.
- Do not trigger AI generation, publishing, scheduling, sending, or ads.
- Do not create/reset production users or mutate production data.
- Do not start Creative Studio implementation or Content Hub redesign in this discovery step.

## Top Contradictions

1. Dashboard can say "Open strategy workflow" while `/strategy` is currently a read-only overview once a draft campaign exists.
2. Campaign detail can show strategy proof as done while the raw campaign badge still says `DRAFT`.
3. Calendar can count strategy-planned content while Content Hub says no generated content plan exists.
4. Calendar uses "scheduled" language around AI planned items, even though real scheduling belongs to `SocialPost.status=SCHEDULED`.
5. Campaign detail exposes Publish and Visuals tabs before the canonical campaign/content/platform readiness contract is visible.

## Recommended First PR

OP-D1.1 Dashboard/Strategy CTA state correction should come first.

Reason: it is small, high-trust, and directly addresses the first user confusion before touching publishing or content lifecycle behavior. The first PR should be display/state wording only:

- dashboard next action labels;
- `/strategy` empty/existing-state labels;
- no generation, no schema, no credit, no publish changes.
