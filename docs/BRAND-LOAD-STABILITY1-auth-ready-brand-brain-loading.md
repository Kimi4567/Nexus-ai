# BRAND-LOAD-STABILITY1 — Auth-ready Brand Brain Loading

## Problem

During authenticated Browser QA for `BRAND-RUNTIME-TRUTH2`, the Brand page could briefly show:

- `تعذّر تحميل Brand Brain`
- `Could not load Brand Brain`

Vercel logs showed a transient `/api/brand` `401` followed by successful `200` responses after the auth session finished resolving. The page was healthy after reload, but the first impression was unstable for a paid user.

## Fix

`useBrandBrain()` now gates `/api/brand` loading behind the shared auth state:

- wait while Supabase auth is still resolving;
- do not call `/api/brand` when the authorization header is empty;
- skip cleanly when auth has resolved unauthenticated;
- retry one transient `401` before surfacing a Brand Brain load error;
- ignore stale in-flight requests after auth state changes.

## Product Truth

This PR only changes Brand Brain loading stability.

It does not change:

- Brand Brain scoring or readiness math;
- Brand Brain saved fields;
- learning events;
- strategy generation;
- content generation;
- image generation;
- approval, scheduling, publishing, manual publishing, Autopilot;
- paid launch or platform push;
- billing, credits, schema, dashboard, or production data.

## Validation

- Focused hook tests cover auth-loading, missing-token, token-ready, and transient-401 retry behavior.
- Browser QA should verify `/brand` no longer lands on a false load-error state after authenticated reload.
