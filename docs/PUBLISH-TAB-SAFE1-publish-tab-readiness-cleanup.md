# PUBLISH-TAB-SAFE1 — Publish Tab Readiness Cleanup

## Audit Finding

The Campaign Room Publish tab mixed publishing readiness with action-oriented and learning-oriented copy. That made the surface feel like a campaign launcher or Brand Brain learning surface even when the current campaign state is scheduled/manual only.

Current QA campaign state:

- 1 post was marked manually published by the user.
- 7 posts are scheduled in NEXUS only and are not published.
- No live URL is saved for the manually published post.
- No connected publishing account is expected.
- No platform/API publishing has occurred.
- Autopilot is disabled.
- Performance should remain pending until real analytics data exists.

## Publish Tab Contract

The Publish tab is a readiness and boundary surface. It explains:

- scheduled posts are not published
- manual publish means the user published outside NEXUS and recorded it
- NEXUS has not published through platform APIs unless platform/API proof exists
- connected account readiness is required before API publishing
- connecting an account does not publish anything by itself
- automation and Autopilot require separate explicit enablement
- performance learning requires real analytics data

The Publish tab is not:

- a campaign launcher
- an autopublish controller
- a paid launch surface
- a Brand Brain teaching/update surface
- a performance-learning surface before analytics data exists

## Manual And API Boundaries

Manual publish is a user-confirmed workflow event. It is not platform proof unless a live URL is saved, and it is not analytics-backed learning.

API publishing is separate. It requires account, page, permission, media, readiness checks, and explicit confirmation. Ready copy now says explicit platform/API publish instead of generic "Publish now".

## Connected Account Readiness

When no connected account is available, the tab shows a locked/readiness state and explains that connecting an account does not publish content or enable automation. If an account exists later, account connection still must not imply publish-ready by itself.

## What Changed

- Added a pure publish-tab summary helper that separates scheduled-not-published, manual published, API published, connected-account state, automation, and performance readiness.
- Added tests for scheduled-not-published, manual-without-URL, connected-but-not-publish-ready, and manual/API separation.
- Added a Publish tab readiness summary to Campaign Room.
- Removed the Publish tab "Teach your Brain" card.
- Added a read-only analytics-required note:
  - "Analytics required for learning. NEXUS can only learn performance patterns after published posts collect real analytics. This tab only shows publishing readiness."
  - "التحليلات مطلوبة للتعلّم. لا يستطيع NEXUS تعلّم أنماط الأداء إلا بعد توفر تحليلات حقيقية للمنشورات المنشورة. هذا التبويب يعرض جاهزية النشر فقط."
- Updated SocialPublisher copy to distinguish explicit platform/API publishing from scheduling and connected-account review.

## What Did Not Change

- No backend publishing behavior changed.
- No cron publishing behavior changed.
- No manual publish backend behavior changed.
- No Brand Brain logic or learning events changed.
- No billing, credits, schema, paid launch, image generation, scheduling, approval, Autopilot, platform push, or production data behavior changed.

## QA Plan

Read-only browser QA only:

- Open Content Hub and confirm mixed state remains one user-confirmed manual publish plus seven scheduled-not-published posts.
- Open Publish tab and confirm no ready-to-activate, active campaign, automated publishing, or Brand Brain learning copy appears.
- Confirm no connected-account state is locked/truth-safe when no accounts are available.
- Confirm scheduled posts are described as scheduled in NEXUS and not published.
- Confirm the manually published post is framed as user-confirmed/manual only and not platform/API proof.
- Confirm Autopilot remains disabled/secondary.
- Confirm Performance remains analytics-pending with no fake KPI cards.
- Do not click publish, manual publish, connect account, schedule, generate, Autopilot, or any confirmation action.
