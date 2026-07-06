# META-ADS-ACCESS1 - Reviewed Ad Account API Readiness

## Purpose

Meta Ads connection, Meta App Review approval, and paid campaign activation are separate product states.

This PR adds a small readiness layer so NEXUS can represent that separation honestly:

1. OAuth can import a Meta Ads account.
2. The account remains API-execution locked by default.
3. After Meta App Review / Business Verification approval, an admin/operator can mark the connected ad account as reviewed for API execution.
4. Paid execution still remains approval-gated: paused platform draft first, final activation later.

## Runtime Boundary

- No Meta App Review submission is performed by this PR.
- No OAuth scope is added or removed.
- No platform API request is made by the new admin route.
- No campaign/ad set/ad/ad creative is created.
- No campaign is activated.
- No credits are spent.
- No SocialPost, campaign.aiOutput, Media, GeneratedVisual, billing, or publish/schedule state is changed.

## Admin API

New route:

`PATCH /api/admin/ad-accounts/[id]/api-access`

Admin-only. Body for enablement:

```json
{
  "hasApiAccess": true,
  "confirmation": "CONFIRM_META_APP_REVIEW_APPROVED",
  "evidenceUrl": "https://developers.facebook.com/apps/<app-id>/app-review/"
}
```

Validation:

- caller must be an `ADMIN`
- account must be a connected active Meta ad account
- account must include `ads_management`, `ads_read`, and `business_management`
- evidence URL must be HTTPS
- confirmation must exactly match the enablement constant

Disablement uses:

```json
{
  "hasApiAccess": false,
  "confirmation": "CONFIRM_DISABLE_META_ADS_API_ACCESS"
}
```

## Durable Audit Ledger

META-ADS-AUDIT-LEDGER1 adds a durable `AdAccountApiAccessReview` table with:

- adAccountId
- reviewedBy
- reviewedAt
- evidenceUrl
- previous value
- next value
- reason

The `AdAccount.hasApiAccess` flag and the `AdAccountApiAccessReview` row are
written in the same admin-only transaction, so there is no API-ready state
change without a corresponding review record.

The route also supports:

`GET /api/admin/ad-accounts/[id]/api-access`

This returns the current safe account readiness and the 25 latest review ledger
rows without exposing access tokens.

Until a broader admin console is finished, this route remains for controlled
founder/operator use only.

## User-Facing Truth

Connections should continue to tell users:

- Meta Ads connected does not mean API execution is ready.
- App Review / operator verification is required before platform draft creation.
- A reviewed API-ready ad account only allows paused platform drafts.
- Activation and spend still require separate final approval in Paid Ads.

This PR adds a read-only Meta Ads API readiness card on `/connections` so users
can see whether a connected Meta Ads account is still operator-review locked or
reviewed for API draft creation. The card exposes no user action to mark API
access ready.

## Validation

Run:

```bash
npm run test -- src/lib/__tests__/metaAdsApiAccess.test.ts src/app/api/admin/ad-accounts/[id]/api-access/__tests__/route.test.ts src/lib/__tests__/platformReadiness.test.ts
npm run test -- src/lib/__tests__/metaAdsApiAccessAuditLedger.test.ts
npm run type-check
npm run build
```

Apply the production migration manually through Supabase SQL Editor:

```sql
-- prisma/migrations/meta_ads_api_access_review_ledger.sql
```
