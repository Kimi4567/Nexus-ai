# APPROVAL-SAFE1 — Approval, Schedule, Publish Boundaries

## Purpose

This PR prepares the Content Hub for approval-only QA after cleaned draft generation.
The product boundary is intentionally conservative:

- Approval means reviewed draft posts move to `APPROVED`.
- Approval does not schedule, publish, or activate Autopilot.
- Scheduling means `APPROVED` posts with valid planned dates move to `SCHEDULED`.
- Scheduling does not publish.
- Manual publish confirmation records a user's separate confirmation.
- API publishing is a separate publishing route and is not part of approval QA.
- Autopilot remains disabled/secondary until explicit future enablement requirements are met.

## What Changed

- Approval result copy now says approval signals were saved, not that Brand Brain was directly updated.
- Approved-only copy now states that approved posts still need scheduling before publishing.
- Automatic publishing copy was removed from the approval result flow.
- Scheduled copy now says scheduled content only and avoids implying that publishing has started.
- `schedule-content-plan` now requires an existing valid `scheduledAt` before moving posts to `SCHEDULED`.
- Invalid or missing planned dates are skipped, and if none are valid the route returns a safe zero-scheduled response.
- The schedule response counts linked posts only among posts actually moved to `SCHEDULED`.

## Compatibility Boundaries

Kept unchanged:

- Existing approval route behavior: `DRAFT` to `APPROVED`.
- Existing publish routes and platform API behavior.
- Existing cron publish behavior.
- Existing Autopilot activation behavior.
- Existing credit, billing, schema, migration, dashboard, and generation behavior.
- Existing saved campaign output and SocialPost rows.

## Next QA

`E2E-APPROVAL-QA1` should test approval only:

- Confirm draft posts move to approved.
- Confirm no posts are scheduled or published.
- Confirm Autopilot does not activate.
- Confirm result copy explains that scheduling and publishing are separate next steps.
- Do not run schedule, publish, Autopilot, visual generation, strategy generation, or content generation.

## Risks

- Some existing campaign-level strategy or Content & Hooks copy may still contain older generated wording because this PR does not rewrite saved output.
- The schedule API now skips approved posts without valid planned dates. This is safer, but a campaign with malformed planned dates will require draft/content correction before scheduling.
