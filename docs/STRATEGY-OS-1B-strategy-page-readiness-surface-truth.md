# STRATEGY-OS-1B - Strategy Page Readiness Surface Truth

## Production QA Finding

After STRATEGY-OS-1 merged, production QA showed the `/strategy` page could display:

- Organic: ready for an initial brief
- Full strategy: ready for full strategy
- Paid ads: planning-only

That combination was contradictory. If paid brief inputs are missing, the page must not say the full strategy is ready.

## Change

The Strategy page now uses the STRATEGY-OS-1 Strategy Brief readiness helper for page-level Organic, Paid, and Full readiness labels.

- Organic can remain ready when core Brand Brain fields exist.
- Missing verified proof remains a warning/constraint and does not block organic strategy.
- Paid displays planning-only only when the paid planning brief exists.
- Paid displays needs paid inputs when budget, conversion destination, lead handling, audience/location, offer, audience, or platforms are missing.
- Full strategy displays organic ready / paid inputs missing when organic is ready but paid inputs are incomplete.
- Full strategy does not use the older advisory full-strategy capability label.

## Workstation Hierarchy

The Workstation hierarchy now reuses the same paid readiness label and next-action label:

- Paid planning can show needs paid inputs instead of planning-only.
- Next recommended action can point to completing the paid brief when full strategy is blocked.

## Unchanged

This PR does not change:

- Strategy generation behavior
- Credit deduction or refund behavior
- `/api/strategy/run-full` behavior
- Saved campaign strategy output
- SocialPost rows
- Content generation
- Visual or image generation
- Approval, scheduling, publishing, manual publish, or Autopilot behavior
- Billing, dashboard, schema, migrations, or environment configuration

## QA Notes

Next QA should verify `/strategy` and the Strategy modal read-only:

- The page no longer says Full strategy is ready when paid inputs are missing.
- Organic remains ready when organic core fields exist.
- Paid remains planning-only or needs paid inputs based on the Strategy Brief helper.
- The modal still blocks Paid and Full when paid inputs are missing.
- The modal confirmation/cost card label matches the selected strategy mode.
- Organic and Paid modes must not be described as Full strategy in the confirmation step.
- No default 5000 budget, ready-to-launch, active, connected-ready, spend-ready, or launch-included copy appears.
