# NEXUS AI - Meta Ads App Review Package

**App:** Nexus AI
**Domain:** https://www.nexus-grow.com
**Reviewer demo:** https://www.nexus-grow.com/meta-ads-review-demo
**Use case:** A business connects its own Meta ad account so NEXUS can prepare paid campaign drafts, create paused platform draft objects after explicit confirmation, activate only after final launch/spend approval, and later read campaign performance.

This package is separate from the organic Facebook Page publishing package in `docs/META_APP_REVIEW_PACKAGE.md`.

Use `docs/META_ADS_SUBMISSION_RUNBOOK.md` for the operational submission checklist, reviewer video script, test asset inventory, and go/no-go gate before pressing Submit in Meta App Review.

## 1. Submission Strategy

Submit the paid Marketing API permissions only when the Meta app is ready for review:

- `ads_management`
- `ads_read`
- `business_management`

Do not request `read_insights` for the paid connection. Meta Ads performance is read through Ads Insights with `ads_read`.

Do not include Instagram organic publishing permissions in this paid review. Organic Facebook Page publishing and paid Meta Ads execution are separate product flows.

## 2. Per-Permission Justification

| Permission | Why NEXUS needs it | Data accessed or changed | Where it is used |
|---|---|---|---|
| `ads_management` | Create and later activate paid campaign objects in the user's own Meta ad account after explicit approval. | Campaign, ad set, ad creative, and ad object fields. Draft objects are created in `PAUSED` state first. | Paid Ads detail page -> Create paused Meta draft; Paid Ads detail page -> Activate after final approval. |
| `ads_read` | Read the user's ad account list and campaign performance after a campaign exists. | Ad account metadata and Ads Insights metrics such as spend, impressions, clicks, CTR, CPC, and actions. | Connections, Paid Ads account selection, Paid Ads performance sync. |
| `business_management` | Access Business Manager ad account hierarchy and account context for the connected business. | Business id/name, ad account ownership/context, account metadata needed for review and setup. | Meta Ads OAuth callback and AdAccount readiness. |

## 3. Product Safety Contract

NEXUS uses a three-stage paid execution contract:

1. **Planning draft:** Strategy, audience, copy, budget assumption, and creative plan are prepared for review. No platform object is created.
2. **Paused platform draft:** After explicit budget and platform-draft confirmations, NEXUS may create Meta campaign/ad set/ad/creative objects in `PAUSED` state only.
3. **Final activation:** After a separate final approval, spend approval, and budget confirmation, NEXUS may activate existing paused objects.

Connecting Meta Ads does not launch ads.
Creating a paid planning draft does not launch ads.
Creating paused platform draft objects does not spend budget.
Activation is the first moment where delivery/spend may begin, and it has its own confirmation gate.

## 4. Reviewer Test Steps

Use a reviewer/test account with access to a test Business Manager, ad account, and Facebook Page.

1. Sign in to NEXUS at https://www.nexus-grow.com.
2. Open https://www.nexus-grow.com/connections.
3. In the Paid Ads section, click **Connect Meta Ads**.
4. Complete Meta OAuth for the requested paid permissions.
5. Confirm NEXUS returns to `/paid-campaigns?connected=meta` and shows connected ad account readiness.
6. Open `/paid-campaigns/new`.
7. Create a Meta paid planning draft. This stores a planning draft only.
8. Generate or review the paid strategy/copy draft. This is planning content only.
9. Open the paid campaign detail page.
10. Confirm **Create paused Meta platform draft** is gated by explicit confirmation checkboxes.
11. Confirm the modal states that NEXUS creates paused draft objects only and does not launch or spend.
12. After confirmation, create paused platform objects in the test ad account.
13. Verify in Meta Ads Manager that campaign/ad sets/ads are `PAUSED`.
14. Confirm **Activate after final approval** remains a separate action with separate confirmations.
15. Activate only in a dedicated reviewer/test scenario where spend approval is explicitly confirmed.
16. Confirm performance sync reads platform metrics only after real platform data exists.

## 5. Reviewer Evidence to Record

- Connections page showing Meta Ads account connection readiness.
- Paid Ads Control Center showing planning drafts and paused platform draft language.
- Paid campaign detail page before platform draft creation.
- Paused platform draft confirmation modal with both acknowledgements.
- Meta Ads Manager showing created objects in `PAUSED` state.
- Final activation modal showing explicit spend, budget, and launch acknowledgement.
- Performance tab showing metrics only after real platform data exists.

## 6. Required URLs

- Privacy Policy: https://www.nexus-grow.com/privacy
- Terms of Service: https://www.nexus-grow.com/terms
- Data Deletion Instructions: https://www.nexus-grow.com/data-deletion
- Data Deletion Callback: `POST https://www.nexus-grow.com/api/social/callback/meta-data-deletion`
- Paid Review Demo: https://www.nexus-grow.com/meta-ads-review-demo
- Connections: https://www.nexus-grow.com/connections
- Paid Ads: https://www.nexus-grow.com/paid-campaigns

## 7. Data Handling Summary

- NEXUS uses Meta OAuth; it never sees or stores the user's Facebook password.
- Access tokens are encrypted at rest and are cleared on disconnect.
- The client never receives raw access tokens.
- `/api/ad-accounts` returns account readiness metadata only.
- `AdAccount.hasApiAccess` gates platform API draft creation after review readiness.
- Generic campaign update routes cannot mark paid campaigns active.
- Activation has a dedicated route and explicit approval requirements.

## 8. Implementation References

- `src/app/api/social/connect/meta-ads/route.ts` - builds paid OAuth URL.
- `src/app/api/social/callback/meta-ads/route.ts` - exchanges OAuth code, stores encrypted token, imports accessible ad accounts, and defaults `hasApiAccess` to false.
- `src/app/api/ad-campaigns/[id]/push-to-platform/route.ts` - creates paused Meta draft objects only after explicit platform-draft and budget confirmations.
- `src/app/api/ad-campaigns/[id]/activate-platform/route.ts` - activates existing paused objects only after final approval, spend approval, and budget confirmation.
- `src/lib/paidBoundary.ts` - central guardrails for paid budget, draft creation, and activation.

## 9. Pre-Submission Checklist

- [ ] Meta app has Marketing API use case enabled.
- [ ] Business Verification is submitted or approved.
- [ ] App is configured with valid domains and OAuth redirect URIs.
- [ ] Privacy Policy includes Meta paid ad account permission usage.
- [ ] Data Deletion Callback and Data Deletion Instructions URL are configured.
- [ ] Reviewer/test Business Manager, ad account, and Page are available.
- [ ] Review video demonstrates paused draft creation before activation.
- [ ] Submit only `ads_management`, `ads_read`, and `business_management`.
- [ ] Do not submit `read_insights` for this paid connection.
- [ ] Do not imply automatic spend, automatic launch, or connected-account launch readiness.
- [ ] Complete the operator checklist in `docs/META_ADS_SUBMISSION_RUNBOOK.md` before submitting.

## 10. Out of Scope

- Organic Facebook Page publishing permissions.
- Instagram organic publishing.
- Google Ads, TikTok Ads, and LinkedIn Ads API execution.
- Automatic campaign activation.
- Spend without explicit final approval.
- Analytics-backed learning before real platform metrics exist.
