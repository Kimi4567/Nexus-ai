# PLATFORM-EXECUTION-TRUTH1 — Platform Execution Readiness Copy

## Purpose

NEXUS should feel like an AI marketing operating system, not a set of disconnected generators. The platform can plan, review, prepare drafts, and guide execution, but the product must not claim live publishing, ad spend, or automatic platform execution before the required platform permissions, readiness checks, and explicit approvals exist.

## Product Contract

- Platform connections provide account context and available permissions.
- Connections do not publish content or spend budget by themselves.
- Scheduled posts are saved in NEXUS until a manual or API publishing path is ready and explicitly confirmed.
- Paid campaign work starts as planning drafts and paused platform drafts where approved API access exists.
- Paid activation and budget spend require a separate final approval path.
- Manual publish means the user published outside NEXUS and NEXUS records that fact only.

## Changes

- Replaced onboarding email copy that implied users can connect accounts and go live directly from NEXUS.
- Replaced lifecycle email copy that implied posts automatically publish after approval or scheduling.
- Reframed Growth/Agency email benefits around publishing readiness and execution review workflows.
- Reframed the Schedule metadata and runtime i18n strings around scheduled content plus publishing readiness.
- Updated the chat assistant platform knowledge so it does not tell users that connections publish directly.
- Renamed the paid draft helper CTA from "AI Suggest" to "Suggest draft settings" so the action reads as a reviewed planning aid.

## Boundaries

- No platform API behavior changed.
- No OAuth, token, publishing, scheduling, paid activation, billing, credits, schema, or data behavior changed.
- No SocialPost, campaign output, Media, GeneratedVisual, or AdCampaign data was mutated by this PR.
- The Supabase refresh-token console error observed during audit remains a separate production reliability issue.

## Validation

- `npm run test -- src/lib/__tests__/platformExecutionTruthCopy.test.ts`
- `npm run type-check`
- `npm run build`
- Runtime copy scan classifies remaining publishing terms as either safe manual-publish copy, safe connected-API copy, or docs/tests.
