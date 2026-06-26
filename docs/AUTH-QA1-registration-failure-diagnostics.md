# AUTH-QA1 Registration Failure Diagnostics

## Issue

Fresh account Strategy E2E QA was blocked at `/auth/register` because Supabase
signup failures surfaced as the generic message:

> Failed to create account. Please try again.

That made it impossible to tell whether the blocker was duplicate email,
invalid email, signup configuration, email delivery, rate limiting, database
user creation, or another Supabase Auth failure.

## What Changed

- Added a focused registration error mapper for known Supabase/Auth signup
  failures.
- Kept the mapper locale-aware so English and Arabic registration pages show
  matching actionable errors.
- Preserved sanitized diagnostic metadata in non-production console warnings.
- Replaced the low-contrast error banner with a light-safe red alert style.
- Added source/unit coverage for the mapped registration failures.

## What Did Not Change

- No Supabase project settings were changed.
- No admin signup or user bypass was added.
- No public `User` creation behavior was changed.
- No auth routing, email confirmation, onboarding, Brand Brain, billing, credits,
  generation, publishing, schema, migration, or env behavior was changed.

## Supabase Settings To Verify Manually

- Email signup is enabled.
- Allowed redirects include localhost and production auth URLs.
- Email confirmation policy matches product expectations.
- SMTP/email provider health is green.
- CAPTCHA and rate limits are configured intentionally.
- Supabase Auth logs include the failed QA emails and their exact failure reason.

## Validation

- `git diff --check` on touched files.
- `npm run test -- src/app/auth/__tests__/registerErrorCopy.test.ts`
- `npm run type-check`
- `npm run build`
- Source scan for registration copy, diagnostics, and unsafe secret/session terms.

## QA Plan

- Open `/auth/register`.
- Submit with unchecked terms and confirm a clear validation error.
- Submit with mismatched passwords and confirm a clear validation error.
- Submit an invalid email format and confirm a clear validation error.
- Confirm the error banner is readable on the light card.
- Confirm there is no console leak of password, tokens, or session data.
- If a real Supabase signup attempt is approved, use only one QA email, record
  the visible mapped error, and do not retry repeatedly.

This PR does not create users, bypass Supabase Auth, or resume Brand Brain /
Strategy E2E generation on its own.
