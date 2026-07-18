# NOORAYA journey remediation roadmap

This roadmap converts the 76 observations in the NOORAYA new-user audit into
release gates. It deliberately separates product defects from external proof so
the release cannot claim live marketing outcomes that have not happened.

The complete observation log and evidence classification are recorded in
[`NOORAYA-NEW-USER-JOURNEY-AUDIT-2026-07-18.md`](./NOORAYA-NEW-USER-JOURNEY-AUDIT-2026-07-18.md).

## Gate A — source-of-truth and financial safety (P0)

- [x] Block strategy, content, creative, publishing, and credit spend when Brand
  Brain contains a material conflict.
- [x] Require a real conversion destination, AOV, margin, verified proof, and
  paid-planning inputs before a sales/paid package is called ready.
- [x] Reject unsupported audiences, claims, direct-response CTAs, platforms, and
  internal workflow language at generation and approval boundaries.
- [x] Keep planned channels distinct from connected/active channels.
- [x] Require immutable copy and media approval evidence before scheduling.
- [x] Reserve/finalize/refund credits idempotently and link new charges to the
  purchased artifact and pricing version.
- [x] Fail closed when the Stripe schedule does not match the product schedule.
- [x] Keep all public database tables behind RLS with no anon/authenticated Data
  API grants; the app uses server-side Prisma access only.

## Gate B — one coherent journey (P1)

- [x] Use one campaign platform set from strategy through Content Hub.
- [x] Show a real 30/60/90 operating roadmap for 90-day strategy requests.
- [x] Count image and video decisions consistently.
- [x] Distinguish proposed dates from scheduled dates.
- [x] Derive campaign portfolio, approvals, execution, and connection priorities
  from the same current campaign truth.
- [x] Make navigation-only actions non-approvable.
- [x] Explain reset scope: brand journey data is deleted; account billing,
  ledger, purchase, and connection history is preserved.
- [ ] Re-run the complete new-user journey after deployment and record one
  traceable artifact ID at every transition.

## Gate C — premium clarity and latency (P1)

- [x] Show explicit in-progress context during reset, onboarding save, and Brand
  Brain save; production latency remains an observability target after deploy.
- [x] Keep instructional text visible after adding list chips.
- [x] Show saved location and language in Business Basics.
- [x] Present identity coverage as a field count, never as an overall 100% score.
- [x] Name each Brand Brain conflict and the affected field on Strategy.
- [x] Explain what a generated follow-up decision is and where it appears.
- [x] Add data freshness to approvals and Today; never render a false empty state
  while their source queries are still resolving.
- [x] Remove duplicate execution/creative actions and use media-specific counts.

## Gate D — agency-grade strategy and creative quality (P1)

- [x] Require measurable success definitions for sales/leads/traffic goals.
- [x] Label unverified problems, audience expansion, and channel rationale as
  hypotheses with a validation method.
- [x] Require paid angles/copies/briefs to be differentiated test cells rather
  than near-duplicate wording.
- [x] Label every missing image/video as a proposed asset until approved evidence
  exists.
- [x] Carry all material missing inputs into the final readiness section.
- [x] Show claim/destination/media risks before bulk copy approval.

## Gate E — proof that cannot be manufactured internally

These are release acceptance tests, not code tasks. They remain incomplete until
the relevant platform permissions and real data exist.

- [ ] Upload and analyse approved product images and video for a real pilot brand.
- [ ] Publish on at least two providers and retain provider post IDs.
- [ ] Run one capped paid pilot with conversion tracking and a kill switch.
- [ ] Ingest verified analytics with freshness metadata.
- [ ] Create, approve, apply, and roll back one learning proposal backed by those
  analytics.

The internal build is releasable only when Gates A–D pass automated and browser
verification. “100% live marketing company” is not claimed until Gate E is also
completed with real provider evidence.
