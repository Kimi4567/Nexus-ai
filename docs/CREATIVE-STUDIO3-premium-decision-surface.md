# CREATIVE-STUDIO3 — Premium Creative Decision Surface

## Purpose

CREATIVE-STUDIO3 turns the Creative Brief page from a raw layered preview into a clearer creative decision workspace.

The goal is not to render or attach media. The goal is to help a marketer, designer, and non-technical user understand:

- what the visual is trying to achieve,
- who it is for,
- why the format fits the platform,
- whether the background, message, CTA, brand layer, and safe zones are ready for review,
- what the next responsible action is.

## Runtime Boundary

This PR keeps the Creative Studio preview read-only and browser-local:

- no image generation,
- no render/upload,
- no media attachment,
- no SocialPost mutation,
- no publish/schedule/manual publish,
- no Autopilot,
- no paid launch/platform push,
- no Brand Brain learning update,
- no credit spend.

Content Hub remains the final post media source of truth.

## Decision Brief Contract

Each preview model now includes a deterministic `decisionBrief`:

- `creativeObjective`
- `audienceMoment`
- `platformFit`
- editable message hierarchy
- readiness status and score
- blockers
- quality signals
- next best action

The decision brief is recalculated after local draft controls are changed, so the user can safely test headline, CTA, brand label, color, and layout changes without saving or mutating data.

## Product Rationale

The previous safe preview was technically correct but still felt like a tool surface. A premium marketing OS needs a clear decision surface: the user should see the creative judgement before touching controls.

This keeps the page practical:

- strategy becomes a creative objective,
- post copy becomes audience/message context,
- platform format becomes platform-fit guidance,
- missing background becomes a real blocker,
- final attachment remains a separate Content Hub decision.

## Future Work

CREATIVE-STUDIO4 can add an explicit, confirm-first render/upload step after the decision surface is proven.

That future step must remain separate from:

- previewing,
- editing local layers,
- publishing,
- scheduling,
- paid launch,
- Brand Brain learning.
