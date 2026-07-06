# STRATEGY-PAGE-IA1 — Strategy Command Center Navigation

## Problem

The Strategy tab had strong strategic content, but the page behaved like a long report. Users could lose orientation because:

- Campaign Room tabs scrolled out of view.
- Strategy section navigation appeared only after a large opening panel.
- The first screen did not clearly separate current state, next action, and operating boundaries.
- The page mixed rich reference material with execution decisions without a persistent navigation anchor.

## Product Decision

Keep the full strategy value, but make the page behave like an operating brief:

1. The Campaign Room tab bar stays visible while the user reviews the page.
2. The Strategy map lives inside the same operating navigation surface, so there is one navigation system instead of two competing tab rows.
3. Strategy map items point only to concrete report sections with matching visible section numbers.
4. The first Strategy panel is a command center, not a report title.
5. The app shell lets page-level sticky navigation work by leaving vertical overflow visible and allowing the document to own scrolling.
6. The primary action remains tied to the correct owner surface:
   - Organic/current post execution goes to Content Hub.
   - Paid-only planning goes to the Paid Planning Brief.
   - The global Strategy workspace remains available as a secondary navigation path.
7. The Strategy tab stays read-only:
   - no publishing
   - no scheduling
   - no ad spend
   - no Brand Brain mutation
   - no generation from this restructuring

## UX Contract

- Strategy answers: what are we doing, why, for whom, and under which limits?
- Content Hub owns: current post records, post review, media state, approval, scheduling, and manual publish state.
- Connections owns: account and platform readiness.
- Paid Launch owns: paid planning and eventual paid execution readiness.
- Brand Brain owns: profile setup and reviewed signals, not hidden updates from this page.

## Validation Notes

The implementation is UI/IA only. It does not change APIs, schema, credits, generated strategy data, SocialPost rows, Media rows, GeneratedVisual rows, publishing, scheduling, Autopilot, paid launch, platform push, or engine behavior.
