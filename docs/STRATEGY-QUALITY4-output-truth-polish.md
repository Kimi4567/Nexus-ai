# STRATEGY-QUALITY4 — Strategy Output Truth Polish

## Context

After STRATEGY-QUALITY3, a controlled production organic strategy run was performed for the current Brand Brain brand, ClinicFlow AI.

- Account: `nesrinhub03@gmail.com`
- Generated campaign: `cmr5a1pxz0005pznxb81qqa7i`
- Requested mode: organic only
- Requested horizon: 30 days
- Requested exact post directions: 7
- Credits: 303 -> 295
- Credit transaction: `RUN_FULL_STRATEGY`, amount `-8`

The generation correctly used the current brand instead of a stale campaign and produced exactly 7 first-month deliverables. The remaining issues were runtime truth polish and professional operating depth.

## Findings

1. Arabic cost-review modal still displayed internal English deliverable labels.
2. Strategy output section label used "Top Hooks" / "أفضل الهوكس", which implied unsupported best-performing truth.
3. Sidebar badge text could visually/extractively merge with the nav label, such as `الربطمهم`.
4. The generated strategy was safer and count-correct, but content angles still needed stronger operating depth: buyer objection, proof asset, response handoff, and production review point.

## Changes

- Localize deterministic strategy deliverable labels before showing them in Arabic cost-review UI.
- Reframe hook section labels as suggested/review-ready hooks, not top/best hooks.
- Add an accessible sidebar label and spacing for nav badges.
- Strengthen strategist prompt and schema for distinct, operational content angles:
  - desired outcome
  - buyer objection
  - proof needed
  - response/follow-up handoff
  - production review point

## Boundaries

This PR does not change billing, pricing, credit deduction, generation routes, campaign status transitions, Content Hub behavior, publishing, scheduling, media generation, paid launch, Autopilot, schema, or data mutation behavior.

No new strategy, content, media, publish, schedule, approval, Autopilot, paid, engine, refund, or admin action is part of this code change.
