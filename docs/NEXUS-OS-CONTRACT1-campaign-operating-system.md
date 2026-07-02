# NEXUS-OS-CONTRACT1 Campaign Operating System Contract

## Purpose

NEXUS should feel like an AI marketing operating system, not a collection of patched generators and tabs.

This contract adds a deterministic Campaign Operating System layer that every Campaign Room surface can use before it decides what to show, what action to recommend, and what claims it is allowed to make.

This first step is helper/tests/docs only. It does not change runtime UI, API routes, schema, persisted data, billing, credits, generation, publishing, scheduling, media attachment, Autopilot, paid launch, or engine behavior.

## Product Laws

1. Strategy is reference material once SocialPosts exist.
2. Content Hub is the source of truth for final post previews, lifecycle, and media attachment.
3. Scheduled does not mean published.
4. Manual publish means the user published outside NEXUS and NEXUS recorded it.
5. API publish requires connected account readiness and explicit confirmation.
6. Autopilot is separate from manual scheduled content and requires explicit enablement.
7. Performance learning requires real analyticsData.
8. Generated backgrounds, concept visuals, and final attached post media are separate asset states.

## Source-Of-Truth Hierarchy

The Campaign Room should resolve state in this order:

1. Brand Brain: durable brand context and reviewed signals only.
2. Campaign strategy / campaign.aiOutput: planning and reference material.
3. SocialPost rows: execution lifecycle, scheduled dates, published/manual state, and current calendar truth.
4. Content Hub media state: final post media readiness and attachment truth.
5. GeneratedVisual rows: concept visuals or generated background assets until explicitly attached.
6. analyticsData / trusted platform metrics: the only source for performance learning.

## Surface Responsibilities

Strategy:
Shows strategy readiness before content exists. Once SocialPosts exist, Strategy becomes reference material and must point users to Content Hub for execution truth.

Content:
Shows whether a content plan exists, whether draft review is needed, and whether current posts live in Content Hub. It must not imply scheduling or publishing.

Calendar:
Uses scheduled/published SocialPosts as the current calendar source of truth. Strategy calendars are planning-only when no SocialPosts are scheduled.

Creative:
Shows creative requirements, generated background/concept status, and media decision readiness. It must not imply generated visuals are automatically attached, scheduled, published, or used in ads.

Publish:
Shows readiness and lock reasons for manual/API publishing boundaries. It must not teach Brand Brain or imply scheduled posts are already live.

Autopilot:
Shows Autopilot as a separate explicit operating mode. Manual scheduled or manually published posts are workflow records, not Autopilot execution.

Performance:
Shows waiting states until analyticsData exists. KPI cards and learning language require real analytics.

## Helper Contract

`deriveNexusOperatingSystem` combines:

- `deriveCampaignOperatingState`
- `summarizeContentHubMediaReadiness`
- strategy calendar detection
- weekly execution plan detection
- generated visual role classification
- connected publishing account readiness
- Brand Brain / analytics learning boundaries

It returns:

- current operating stage
- truth flags
- lifecycle/media/publishing counts
- calendar source
- generated visual summary
- per-surface titles, helper copy, blockers, and primary actions
- next best action
- product laws

The helper is pure and deterministic. It does not fetch, mutate, spend credits, generate assets, attach media, publish, schedule, or update Brand Brain.

## Guarded Scenarios

Progressed mixed-state campaign:
One manually published post and seven scheduled posts should not make Strategy say the campaign needs content planning again. Strategy is reference material, Content Hub is the source of truth, Publish shows platform/API readiness, and Performance waits for analytics.

Scheduled posts without legacy calendar fields:
Calendar should use SocialPosts, not claim there is no calendar just because old strategy calendar fields are missing.

Missing weeklyExecutionPlan after scheduling:
Autopilot should not ask for strategy regeneration on progressed campaigns. Manual scheduled content is not Autopilot execution.

Generated visual ambiguity:
Completed visuals without an explicit asset role remain ambiguous. They are not automatically final post media or paid creative.

Manual publish vs API publish:
User-confirmed manual publish is a record of external user action. API publish is a separate platform path that requires readiness and confirmation.

## Intended Next Step

After this contract is merged, runtime surfaces can be refactored one-by-one to read from this single operating-system snapshot instead of each tab inventing its own truth.

The target is not more copy patches. The target is one coherent campaign state machine that makes every button, label, lock reason, and recommended next step explainable.
