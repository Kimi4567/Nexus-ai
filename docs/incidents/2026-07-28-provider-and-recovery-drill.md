# Incident Drill — AI Provider Authentication, Quota, and Database Recovery

Date: 2026-07-28 (Asia/Dubai)  
Severity: SEV-2  
Status: Contained; AI batch completion blocked on provider quota  
Customer impact: No customer request was executed by this drill. No product credits, Stripe charges, public posts, emails, SMS, or ad spend were created.

## Detection

The live strategy reliability evaluation detected:

- direct OpenAI requests returned HTTP 401 using the currently configured long-lived key;
- Vercel AI Gateway OIDC successfully returned one real strategy completion;
- a subsequent concurrent 20-case batch returned HTTP 429 after the available gateway limit was reached;
- one Full strategy completed generation but was rejected by the deterministic marketing-quality gate for forbidden brand language.

## Containment performed

1. Stopped the batch after bounded retries proved the 429 was persistent.
2. Preserved fail-closed quality behavior; the rejected Full output was not persisted.
3. Confirmed the evaluation path does not charge product credits or create campaigns.
4. Added provider routing that prefers Vercel OIDC, retains direct OpenAI as a fallback, strips fenced JSON safely, and supports a Gateway model fallback.
5. Added bounded 429 backoff.
6. Updated the live evaluation to mirror production's directed quality-repair pass before final validation.
7. Kept provider credentials out of logs and removed temporary environment files after each check.

## Database recovery drill

The production public schema was dumped read-only and restored into an isolated local PostgreSQL 17 cluster.

- dump size: 875,212 bytes
- dump SHA-256: `5a40108c...e25b0572`
- restored tables: 60
- representative restored counts:
  - users: 21
  - workspaces: 18
  - campaigns: 25
  - credit transactions: 430
  - landing pages: 4
  - leads: 5
- the ephemeral dump and local cluster were removed after verification.

## Recovery criteria and remaining action

- Database restore criterion: PASSED.
- Direct OpenAI authentication criterion: FAILED — replace/revoke-and-rotate the invalid key if direct fallback is still desired.
- AI Gateway smoke criterion: PASSED.
- 20 successful live evaluations: BLOCKED — raise/restore AI Gateway quota or configure a funded provider, then rerun `npm run eval:strategy`.
- Supabase leaked-password protection: BLOCKED — current organization plan is Free; enable after upgrading to a plan that exposes the control.

## Follow-up owners

- Engineering: deploy the OIDC provider-routing change after the full release gate passes.
- Operations: configure funded AI Gateway/provider capacity and rerun the 20-case report.
- Security/Founder: approve Supabase plan upgrade and enable leaked-password protection.
- Operations: schedule the next backup/restore drill and retain the full checksum in the private incident evidence store.

