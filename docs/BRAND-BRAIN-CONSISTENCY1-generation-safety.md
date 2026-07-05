# BRAND-BRAIN-CONSISTENCY1 — Generation Safety Guard

## Problem

Brand Brain can be complete but internally inconsistent after a user resets or changes industry direction. A healthcare SaaS profile can still contain stale paid/funnel fields from a previous home-cleaning business, such as lead handling, objections, sales cycle, or seasonality.

If those fields are injected into strategy generation, NEXUS can produce a technically valid but strategically incoherent plan.

## Boundary

This change does not edit production data and does not rewrite Brand Brain. It only protects generation context.

## Behavior

- Detect the dominant Brand Brain anchor category from stable identity/offer/audience fields.
- Screen deeper strategy fields before generation context assembly.
- Exclude fields that clearly belong to a different industry category.
- Pass a prompt-safe note listing excluded field names only, never the stale values.
- Use the safe profile for server-side strategy capability/readiness context.

## Current covered case

- `ClinicFlow AI` / clinic operations SaaS profile
- Stale home-cleaning fields in:
  - `leadHandling`
  - `customerObjections`
  - `salesCycleLength`
  - `seasonality`

## Product truth

This is not a data repair tool. The user still needs a visible Brand Brain review/cleanup experience later. This guard prevents contaminated context from being used silently during strategy generation.

## Non-goals

- No schema changes.
- No production data mutation.
- No admin cleanup.
- No strategy generation.
- No content generation.
- No credit behavior change.
- No publishing, scheduling, media, Autopilot, paid launch, or platform behavior change.
