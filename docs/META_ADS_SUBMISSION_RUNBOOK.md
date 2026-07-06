# META-ADS-SUBMISSION-RUNBOOK1 - Meta Ads App Review Submission Runbook

This runbook is the operator checklist for submitting NEXUS AI's paid Meta Ads / Marketing API flow for App Review. It is intentionally separate from the organic Facebook Page publishing package.

## Objective

Prepare Meta App Review for the paid ads execution path:

1. connect the user's Meta Ads account,
2. read available ad-account/business context,
3. create paid planning drafts inside NEXUS,
4. create Meta platform objects only as paused drafts after explicit confirmation,
5. activate only after a separate final launch, spend, and budget approval,
6. read real platform metrics only after they exist.

## Non-Goals

- Do not request Instagram organic publishing permissions in this paid review.
- Do not request `read_insights` for the paid connection; paid Ads Insights are covered by `ads_read`.
- Do not submit automatic publishing, automatic paid launch, automatic budget spend, or connected-account launch readiness claims.
- Do not show manual publish as a Meta API action. Manual publish means the user published outside NEXUS and NEXUS records that status only.

## Permissions to Submit

| Permission | Submit? | Product reason | Boundary |
|---|---:|---|---|
| `ads_management` | Yes | Create and later activate campaign/ad set/ad/creative objects in the user's ad account. | Paused draft first; final activation is separate. |
| `ads_read` | Yes | Read ad account metadata and Ads Insights metrics after real platform data exists. | No fake metrics or learning before platform data exists. |
| `business_management` | Yes | Read Business Manager and ad account hierarchy for setup/readiness. | Account selection and readiness only. |
| `read_insights` | No | Not needed for this paid flow. | Keep out of the paid OAuth request and review submission. |
| Organic Facebook / Instagram scopes | No | Separate review package. | Do not mix organic publishing with paid execution review. |

Official references:

- Meta Marketing API authorization: https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization
- Meta permissions reference: https://developers.facebook.com/docs/permissions/
- Ads Management Standard Access: https://developers.facebook.com/docs/features-reference/ads-management-standard-access/
- Data deletion callback: https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback

## Meta Dashboard Checklist

Complete these before pressing Submit:

- [ ] App name, icon, contact email, app domain, and category are current.
- [ ] App domain includes `nexus-grow.com`.
- [ ] Privacy Policy URL is `https://www.nexus-grow.com/privacy`.
- [ ] Terms URL is `https://www.nexus-grow.com/terms`.
- [ ] Data Deletion Instructions URL is `https://www.nexus-grow.com/data-deletion`.
- [ ] Data Deletion Callback is `POST https://www.nexus-grow.com/api/social/callback/meta-data-deletion`.
- [ ] Facebook Login / OAuth Valid Redirect URIs include:
  - `https://nexus-grow.com/api/social/callback/meta-ads`
  - `https://www.nexus-grow.com/api/social/callback/meta-ads`
- [ ] Marketing API use case is enabled.
- [ ] Business Verification is submitted or approved.
- [ ] The paid permissions selected for App Review are exactly:
  - `ads_management`
  - `ads_read`
  - `business_management`
- [ ] Organic Facebook permissions are reviewed through `docs/META_APP_REVIEW_PACKAGE.md`, not this paid package.

## Test Asset Inventory

Record these before filming or submitting:

| Asset | Required value |
|---|---|
| Reviewer/test NEXUS account | Email, role, and workspace |
| Meta test user | Must have role on the Meta app |
| Business Manager | ID and display name |
| Ad account | ID, currency, timezone, status, and whether it is a test/sandbox account |
| Facebook Page / identity | Page ID/name used as publisher identity for ads |
| Destination URL | A safe URL owned by the business or test environment |
| Budget sample | Planning budget only until activation confirmation |
| Creative sample | Non-sensitive placeholder creative/copy for review |
| Meta Ads Manager evidence | Screenshot/video showing created objects remain `PAUSED` |

Do not use real customer data in the review video.

## Reviewer Video Script

Keep the video focused and literal:

1. Open `https://www.nexus-grow.com/meta-ads-review-demo`.
2. Explain the five-step paid boundary: connect, plan, paused draft, final activation, metrics.
3. Open `https://www.nexus-grow.com/connections`.
4. Show **Connect Meta Ads** and explain the requested permissions.
5. Complete Meta OAuth only with the reviewer/test Meta account.
6. Confirm the return to `/paid-campaigns?connected=meta`.
7. Open `/paid-campaigns/new`.
8. Create or show a paid planning draft. State clearly that planning is not spend approval.
9. Open the paid campaign detail page.
10. Show **Create paused Meta platform draft**.
11. Show both required acknowledgements are unchecked by default and the final action is disabled until they are checked.
12. In a test-only review scenario, create the paused platform draft objects.
13. Show Meta Ads Manager with campaign/ad set/ad objects in `PAUSED` state.
14. Return to NEXUS and show **Activate after final approval** is a separate action.
15. Show launch, spend, and budget acknowledgements are separate from paused draft creation.
16. Do not activate a real campaign unless using a dedicated reviewer/test ad account with explicit owner approval.
17. Show metrics/performance surfaces and state they require real platform data.

## Internal Stop Conditions

Stop the submission and fix before review if any of these are true:

- The paid OAuth URL requests `read_insights`, Instagram scopes, or organic Facebook publishing scopes.
- The product says a connected Meta Ads account is ready to launch.
- A planning budget is treated as spend approval.
- Platform draft creation can produce active objects.
- Final activation lacks explicit launch, spend, and budget acknowledgement.
- Generic paid-campaign update routes can mark campaigns or ad sets active.
- Privacy/Terms omit the no-spend/no-launch boundary.
- The reviewer demo contains a final action button that could mutate data.

## Runtime Evidence Checklist

- [ ] `/meta-ads-review-demo` is public/read-only and has no mutation action.
- [ ] `/privacy` explains paid permissions, token handling, data deletion, and no-spend boundary.
- [ ] `/terms` separates connected accounts, manual publish records, paused drafts, and final paid activation.
- [ ] `/connections` explains Meta Ads readiness without launch claims.
- [ ] `/paid-campaigns/new` frames paid budget as planning until explicit approval.
- [ ] Paid detail page creates paused platform drafts only after two acknowledgements.
- [ ] Paid detail page activates only after final launch/spend/budget approval.

## Known Operational Gap Before Real Customers

`AdAccount.hasApiAccess` intentionally defaults to `false` after OAuth import. After Meta App Review and Business Verification are approved, NEXUS needs an operator-safe way to mark reviewed ad accounts as API-ready or to derive readiness from verified permission diagnostics.

Until that follow-up exists, do not promise self-serve paid API execution to customers. Reviewer/test flows can still demonstrate the boundary with controlled test accounts.

## Go / No-Go

Go only when:

- App settings, legal URLs, data deletion, and redirect URIs are configured.
- Test Business Manager, ad account, Page identity, and review account are ready.
- Video proves paused-first behavior and separate final activation.
- Source tests pass for scope separation and paid boundary rules.
- Production `/meta-ads-review-demo`, `/privacy`, and `/terms` are live.

No-go if any launch, spend, learning, or connected-account readiness claim is unsupported by the runtime.
