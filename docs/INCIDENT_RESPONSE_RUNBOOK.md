# NEXUS Incident Response Runbook

Owner: Engineering / Operations  
Last reviewed: 2026-07-28  
Applies to: production authentication, billing, AI generation, publishing, analytics, CRM, lifecycle messaging, database, and media systems.

## Severity and response targets

| Severity | Examples | Acknowledge | Contain |
| --- | --- | ---: | ---: |
| SEV-0 | Confirmed data exposure, destructive cross-workspace write, live payment or ad spend without approval | 10 min | 30 min |
| SEV-1 | Authentication unavailable, paid entitlement corruption, duplicate charge, unreconciled provider publish, database unavailable | 15 min | 60 min |
| SEV-2 | One provider path unavailable with a safe fail-closed fallback, delayed analytics, generation quota exhaustion | 30 min | 4 hours |
| SEV-3 | Degraded non-critical feature or isolated UX issue | 1 business day | Planned fix |

## First 15 minutes

1. Open an incident record with start time, detector, affected surface, severity, owner, and evidence links.
2. Preserve evidence. Record request IDs, provider IDs, deployment IDs, relevant database row IDs, and timestamps. Never paste tokens or customer content into the record.
3. Fail closed:
   - stop billing fulfillment when Stripe signature, price, or plan mapping is uncertain;
   - stop auto-publishing when consent, immutable approvals, integration ownership, or provider evidence is missing;
   - stop lifecycle delivery when consent or suppression state is uncertain;
   - do not persist AI output that fails the deterministic contract or quality gate.
4. Determine whether credits, money, public content, customer data, or ad spend changed.
5. If customer-visible state changed, assign a communications owner and define the next update time.

## Containment controls

### AI generation

- Prefer Vercel AI Gateway OIDC over long-lived provider credentials.
- On authentication failure, do not charge product credits.
- Retry 429 only with bounded backoff. Stop reliability batches when the account quota remains exhausted.
- Keep generated strategy behind contract, grounding, and marketing-quality gates.

### Stripe

- Require `sk_test_` during sandbox drills and keep `BILLING_LIVE_MODE_APPROVED=false`.
- Refuse unknown or mismatched Price IDs.
- Use idempotency keys for Checkout and durable webhook event claims.
- Reconcile refunds against the exact invoice or wallet grant.
- Stripe Live activation requires recorded legal/commercial approval and a separate deployment change.

### Publishing and paid media

- Require immutable copy, media, schedule, and explicit auto-publish consent.
- A post is provider-published only when `platformPostId` or an equivalent provider receipt is persisted.
- A paid campaign remains DRAFT/PAUSED until a separate launch approval snapshot exists.
- If the provider succeeds but local persistence fails, record `RECONCILIATION_REQUIRED`; never silently retry a potentially duplicated publish.

### Database and workspace isolation

- Stop writes on suspected cross-workspace access.
- Preserve audit rows and affected identifiers.
- Use Supabase point-in-time/platform restore where available for production recovery.
- Use `npm run db:verify-backup-restore` only with the explicit safety flag and exact expected host. The drill restores into an isolated local Postgres cluster and removes it afterward.

### Lifecycle messaging

- Consent must be `GRANTED`, destination must not be suppressed, copy must be approved, and provider delivery must be separately enabled.
- Bounce, complaint, and suppression webhooks must add or preserve durable suppressions.
- Never infer consent from the presence of an email address or phone number.

## Recovery validation

Recovery is not complete until the affected flow is exercised end-to-end and evidence is saved:

- auth: login, refresh, logout, and workspace isolation;
- AI: one real provider completion plus contract/quality success and credit truth;
- billing: signed webhook, entitlement update, renewal, cancellation, and refund reconciliation;
- publishing: provider ID, public URL/status, analytics read, and no duplicate request;
- database: restored schema and representative row counts;
- messaging: consent check, provider message ID, delivered/bounced webhook, and suppression behavior.

## Communications template

> We identified a problem affecting **[surface]** beginning at **[time/timezone]**.  
> Impact: **[verified impact only]**.  
> Containment: **[action]**.  
> Data/money/publication status: **[verified state]**.  
> Next update: **[time]**.

## Closure requirements

- Root cause and contributing factors
- Exact affected scope
- Evidence that containment and recovery worked
- Credit/refund/reconciliation decision
- Preventive code/configuration change
- Owner and due date for every remaining action
- Customer communication, if any
- Runbook or monitoring update

