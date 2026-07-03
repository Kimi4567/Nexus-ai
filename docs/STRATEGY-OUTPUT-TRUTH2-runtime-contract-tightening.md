# STRATEGY-OUTPUT-TRUTH2 — Runtime Contract Tightening

## Why

Production QA after the Brand Brain reset found the new LedgerFlow strategy was relevant, but three runtime truth issues remained:

- Brand memory messaging still implied the user had to complete a profile even when core Brand Brain fields were already saved.
- `youtube_shorts` could render as `Youtube_shorts` in user-facing platform summaries.
- The paid cost review promised a fixed organic direction count, while the strategist prompt still allowed "up to" that count.

## Product Contract

- Brand Brain readiness copy must distinguish core profile completeness from proof, analytics, and reviewed signal enrichment.
- Platform labels shown to users must be polished display names, not raw storage keys.
- The organic post direction count shown in the cost review is binding for the first detailed strategy window.
- `contentAnglesDetailed` must return exactly the contracted organic direction count when organic scope is included.
- `weeklyExecutionPlan.deliverables` must distribute exactly that count as countable post directions.
- Strategy output remains a review artifact only; it does not create saved Content Hub posts, SocialPost rows, schedules, publishing, or ads.
- CTAs such as "Download now" are not allowed unless a downloadable asset, app, file, or lead magnet was explicitly provided.

## Scope

Changed:

- Brand Brain readiness/analytics copy for partial memory states.
- YouTube Shorts platform display normalization.
- Strategy generation instructions and prompt contract for exact organic direction counts.
- Campaign strategy display labels for platform and tone values.
- Focused tests for the above contracts.

Not changed:

- Credits or billing behavior.
- Strategy generation pricing.
- Database schema.
- Campaign, SocialPost, Media, or GeneratedVisual rows.
- Approval, scheduling, publishing, manual publish, Autopilot, paid launch, or engine behavior.

## QA Notes

This PR does not repair already-saved strategy JSON. It hardens future generation and display surfaces. Existing saved campaigns may still need regeneration after merge to validate a fresh output against the tightened contract.
