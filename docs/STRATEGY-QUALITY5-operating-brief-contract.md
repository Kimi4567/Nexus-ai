# STRATEGY-QUALITY5 — Operating Brief Contract

## Why this exists

The ClinicFlow AI controlled strategy generation proved that the strategy flow was safe and count-correct, but not yet strong enough as an agency operating artifact.

Observed weaknesses:

- content angles could omit buyer objection, proof needed, response handoff, and marketer review point
- weekly plans could shorten later weeks into partial objects without assets, execution notes, or review points
- asset requirements could be absent
- Arabic output could still include English fallback format labels such as `Video` or `Carousel or short social post`

These are not runtime truth issues, but they make a generated strategy feel less like a real marketing department and more like generic AI planning.

## Product contract

Future saved campaign strategies must behave like reviewable operating briefs:

- every content angle includes the practical outcome, objection, required asset/proof, response handoff, and review point
- every weekly execution item includes countable deliverables, platforms, assets needed, CTA, success metric, execution note, and review points
- asset requirements are always present and separated into must-have, optional, organic, paid-planning, proof, and next-to-create buckets
- Arabic user-facing format labels are Arabic; platform and brand names may remain as provided
- missing proof or execution data becomes a review task, not a hallucinated fact

## Implementation

- Strengthened the strategist prompt so `assetRequirements` and full weekly execution objects are required.
- Tightened the Arabic output contract to prevent English format fallback values in Arabic output.
- Strengthened `campaignStrategyContract` so weak operating depth fails before persistence.
- Added `guardStrategyOutputContract` backfills for:
  - content angle operating fields
  - weekly assets/execution/review fields
  - asset requirements
  - Arabic format labels
- The Campaign Room strategy surface passes the saved strategy language into the guard, so older Arabic saved strategies are also displayed without English fallback format labels such as `Video`, `Post`, or `Carousel or short social post`.

## Boundaries

This PR does not:

- generate or regenerate any strategy
- mutate existing campaign output
- approve, schedule, publish, or manually publish anything
- spend credits
- change schema, billing, dashboard, media, paid launch, platform push, Autopilot, engine, or PR #164

The fix affects future strategy generation persistence and safe runtime display of already saved strategy output. It does not change saved campaign data.
