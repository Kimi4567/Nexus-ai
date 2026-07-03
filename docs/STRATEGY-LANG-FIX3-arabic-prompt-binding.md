# STRATEGY-LANG-FIX3 — Arabic Prompt Binding

## Why

After STRATEGY-LANG-FIX1 and STRATEGY-LANG-FIX2, Arabic strategy runs are safe:

- English-heavy Arabic-selected output is rejected before campaign persistence.
- Users see a safe localized error instead of internal contract details.
- Credits are restored when guarded generation fails.

The remaining issue is success rate. The model can still mirror English Brand Brain source text or English JSON schema descriptions into user-facing strategy values, causing the guard to block the result.

## Change

This follow-up strengthens the strategy prompt with a dedicated Arabic output contract:

- JSON keys stay English.
- Brand, product, platform, and technical format names may remain as provided.
- All user-facing values must be natural Modern Standard Arabic.
- English Brand Context and schema descriptions are source/instruction text only.
- The prompt gives concrete bad/good examples for campaign name, CTA, and readiness items.
- The same Arabic contract is repeated immediately before the JSON schema so field descriptions are not copied into output values.

The shared Arabic language helper also clarifies that English source notes or schema descriptions must be translated or adapted for user-facing Arabic values.

## Boundaries

This does not change:

- Strategy pricing or credit logic.
- Strategy readiness gates.
- Campaign persistence.
- Strategy output contract enforcement.
- UI copy.
- Billing, dashboard, publishing, scheduling, Autopilot, media, paid launch, or engine behavior.

If the model still produces English-heavy user-facing strategy output, the existing guard remains the source of truth and blocks persistence.

