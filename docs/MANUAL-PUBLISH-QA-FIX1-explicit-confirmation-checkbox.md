# MANUAL-PUBLISH-QA-FIX1 — Explicit Confirmation Checkbox

## Context

MANUAL-PUBLISH-CONTRACT-AUDIT1 found the manual publish backend contract safe, but the client confirmation modal needed a stronger explicit acknowledgement before any controlled manual-publish QA.

## Server Contract Summary

- The manual publish route is authenticated and workspace-owner scoped.
- Only `SCHEDULED` + `MANUAL` posts can be marked `PUBLISHED`.
- `DRAFT`, `APPROVED`, already `PUBLISHED`, `FAILED`, and `AUTO` posts are rejected.
- No platform publish API is called.
- No credits are touched.
- Status history records `SCHEDULED` to `PUBLISHED` with actor `USER`.
- Learning events use `POST_MANUALLY_PUBLISHED`, not automatic publishing.

## UI Blocker Fixed

The modal previously allowed the final confirmation button to be clicked immediately after opening the modal. The UI now requires a local acknowledgement checkbox before the final manual-publish confirmation is enabled.

## Checkbox Requirement

The modal now requires the user to check:

- English: `I confirm I published this post outside NEXUS.`
- Arabic: `أؤكد أنني نشرت هذا المنشور خارج NEXUS.`

The helper text clarifies that NEXUS only records the status and does not publish to any platform.

## Final Button Copy

The final button now uses explicit confirmation language:

- English: `Confirm I published it manually`
- Arabic: `أؤكد أنني نشرته يدويًا`

It no longer uses the bare Arabic state label `تم النشر يدويًا`.

## Reset Behavior

The checkbox resets to unchecked when:

- the modal opens for a post,
- the modal closes or is cancelled,
- manual publish completes,
- the user switches to another post modal.

## What Did Not Change

- Manual publish backend route behavior did not change.
- Manual publish planner behavior did not change.
- Post status transition rules did not change.
- Learning event behavior did not change.
- Live URL remains optional.
- No platform connection, platform publish call, scheduling, approval, Autopilot, image generation, generation, billing, credits, schema, dashboard, or billing page behavior changed.

## Next QA

Run controlled read-only modal QA before any actual manual publish test:

- open one scheduled manual-publish modal,
- verify the checkbox is unchecked by default,
- verify the final confirmation button is disabled until checked,
- toggle the checkbox only if no network/backend request fires,
- close and reopen the modal to verify reset,
- do not click final confirmation.
