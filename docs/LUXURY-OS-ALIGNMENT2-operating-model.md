# LUXURY-OS-ALIGNMENT2 Operating Model

## Decision

NEXUS should not present every page as a generic dashboard. The new premium UI only works if every surface has a clear operating responsibility.

## Page Responsibilities

- Dashboard: system health, recommended next action, and account-level activity.
- Brand Brain: brand memory inputs, constraints, reviewed signals, and readiness.
- Strategy: scope, mode, assumptions, cost review, and the operating promise.
- Campaign Portfolio: choose which campaign to operate, inspect phase/readiness, and decide the next move.
- Content Hub: production queue and final post workspace. Copy, media decisions, review status, and SocialPost-linked assets live here.
- Creative/Creative Brief: visual direction, production requirements, asset intake, and draft composition before final attachment.
- Publish: publishing readiness, connected-account state, lock reasons, and explicit publish boundaries.
- Paid Launch: paid planning/execution readiness only after permissions, tracking, budget, and explicit approval.
- Connections: platform accounts, permission state, OAuth readiness, and execution prerequisites.
- Templates: campaign starters that create initial strategic context only; they do not generate, publish, or spend credits by themselves.
- Settings: operating-system configuration for account, team, language, permissions, and integrations; it does not change campaign promises.

## Campaigns vs Content Hub

Campaigns is the command layer. It answers:

- Which campaign are we operating?
- What scope did the user request?
- What stage is it in?
- What is blocked?
- What should happen next?

Content Hub is the production layer. It answers:

- Which posts exist?
- Which post copy/media is ready?
- Which post needs review?
- Which image/media is attached to the final preview?
- What is ready for scheduling/publishing after approval?

They must not duplicate each other. Campaigns may link to Content Hub, but it should not pretend to be the final post production workspace.

## Studio vs Content Hub

Studio is the creative workshop. It should answer:

- What visual assets, variants, templates, backgrounds, and editable layers are available?
- What can be improved, resized, remixed, or generated?
- Which creative direction supports the strategy?

Content Hub is the delivery board. It should answer:

- Which final post package exists for each channel?
- Does the package have copy, platform, media, and lifecycle status?
- What must be reviewed before approval, scheduling, or publishing?

Content Hub should not behave like a second Studio or a visual gallery. If an image appears in Content Hub, the product must explain whether it is a draft background, uploaded asset, generated post media, or final post preview. Showing an asset must not imply publish, schedule, ad usage, or Brand Brain learning.

## Strategy As The Spine

Strategy is the operating spine of the product. It decides the campaign scope, audience, positioning, content pillars, channel assumptions, execution risks, and readiness gates.

Every downstream page must translate the strategy into its own operational responsibility:

- Campaign Portfolio routes the user to the right campaign decision.
- Content Hub turns strategy into post-level copy and media review.
- Creative turns strategy requirements into visual direction and assets.
- Publish checks connected accounts, locks, explicit confirmations, and platform readiness.
- Performance only reports real analytics after data exists.

No downstream page should create its own disconnected promise. If a card cannot be traced back to strategy, Brand Brain, user input, platform connection state, or real analytics data, it should be removed, disabled, or clearly marked as planning-only.

## Button Contract

Every visible button must be one of:

- A real navigation link to the correct workflow.
- A disabled future capability with honest copy.
- A mutation action with explicit confirmation, cost, and consequence copy.

No button should imply generation, publishing, paid spend, attachment, analytics learning, or platform readiness unless that action is actually available and guarded.

## Trust And Pricing

- Credits are spent only after an explicit cost review.
- Organic, Paid, and Full strategy modes must affect what downstream pages show.
- Positive budget input is planning context, not approved spend.
- Publishing and paid execution need platform accounts, permissions, media readiness, and approval.
- Performance learning needs real analytics data.

## Current Implementation Notes

- Campaign Portfolio now states that detailed production lives in Content Hub.
- Campaign Portfolio archive is now guarded by an explicit confirmation because it changes campaign state.
- Content Hub is reframed as Content Production Hub.
- Content Hub format chips are real filters, not decorative chips.
- Content Hub primary actions route to production review, publishing readiness, and campaign strategy instead of generic new-content shortcuts.
- Content Hub "ready for publishing" wording is now "ready for publish review" so scheduled/approved content is not confused with platform/API publishing.
- Campaign Content Hub now has a production handoff board that separates Studio asset creation from Content Hub final post review.
- Strategy now exposes the updated operating contract: Brand Brain -> Strategy -> Campaign Portfolio -> Content Hub -> Execution.
- Strategy document index links to real sections instead of being decorative.
- Strategy publish/performance links route to the active campaign tab when a campaign exists.
- StrategySpineCard now appears across the main operating surfaces so each page states where it sits in the Brand Brain -> Strategy -> Content -> Creative -> Publish -> Performance path.
- Dashboard, Templates, and Settings now explicitly route back to strategy/context instead of behaving like disconnected admin screens.
- Creative Studio header, tabs, thumbnails, asset tabs, copy variants, and CTA choices now perform real local navigation/selection; unfinished share/export/AI tools are disabled with honest copy.
- Calendar no longer shows a fake week tab; it switches between the month timeline and the real review queue, and analysis/task links route to their operating surfaces.
- Settings no longer exposes avatar/API-key controls as dead actions; unavailable controls are disabled until a real secure flow exists.
- Strategy detail actions now jump to actual strategy sections instead of acting as decorative links.

## Next UX Work

- Bring Campaign Room strategy, creative, publish, and paid surfaces into the same operating contract.
- Wire remaining premium cards to their real workflow or mark them as disabled/future.
- Add pricing/trust explanations where a user is about to spend credits, generate assets, or connect execution platforms.
- Audit all dashboard/sidebar routes for visual consistency with the luxury OS reference.
