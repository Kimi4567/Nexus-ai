# Strategy Reliability — 20 live runs

Date: 2026-07-28 (Asia/Dubai)  
Provider path: OpenAI-compatible production strategist path  
Scope: 8 Organic, 6 Paid, 6 Full; English and Arabic  
Persistence: disabled by the eval harness; no campaigns, product-credit charges, publishing, email/SMS, or ad spend  
Model behavior: real provider calls and production contracts/quality gates; no mocked model output

## Method

The corpus was split into three mode groups. Each group ran sequentially, with the
three groups started at the same time. This intentionally exposed the currently
available provider capacity; bounded application retries were left enabled.

The live sample complements the signed-in browser journey already exercised for
Organic, Paid, and Full. It is not a replacement for the UI smoke run, and the UI
smoke is not counted among the 20 provider results below.

## Baseline results

| Mode | Requested | Passed | Failed | Pass rate | First-pass success | Repaired successes | P50 | P95 | Provider calls | Recorded provider cost |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Organic | 8 | 7 | 1 | 87.5% | 0 | 7 | 82.577s | 140.244s | 16 | $0.824378 |
| Paid | 6 | 2 | 4 | 33.33% | 0 | 2 | 135.163s | 179.363s | 16 | $0.900423 |
| Full | 6 | 0 | 6 | 0% | 0 | 0 | 24.783s | 221.277s | 3 | $0.225027 |
| **Total** | **20** | **9** | **11** | **45%** | **0** | **9** | **95.049s** | **179.363s** | **35** | **$1.949828** |

Total measured usage was 235,171 input tokens and 143,614 output tokens.

## Failure classification

- 8 runs failed because the provider returned HTTP 429 after bounded retries.
- 2 Arabic Paid runs reached deterministic validation but failed paid-package
  distinctness (`audienceHypotheses.distinctTests` and
  `adCopyVariations.distinctCopy`).
- 1 Full run reached deterministic validation but failed an ungrounded audience
  expansion.

The baseline therefore shows two independent problems:

1. Provider capacity cannot sustain three concurrent strategy runs with the
   current quota.
2. Paid/Full output still needs stronger focused repair for distinctness and
   exact Brand Brain grounding.

## Remediation performed during the run

- A destination-less Organic failure was reproduced, then fixed by:
  - reporting every offending CTA path instead of one generic `strategy.cta`;
  - directing the repair across all public CTA surfaces;
  - forcing destination-free actions when no verified destination exists;
  - constraining ungrounded audience/context repairs to reviewed Brand Brain
    facts.
- Failed eval results now retain calls, tokens, provider cost, repair state,
  issue codes, affected paths, and exact validator findings.
- Final Paid contract failures that are isolated to `paidPlanning` now use a
  second focused Structured Output repair instead of regenerating the complete
  strategy document.
- Paid repair instructions now require pairwise-distinct audience tests, ad
  angles, copy structures, and creative treatments in both English and Arabic.

The original Organic fashion reproduction passed after remediation with contract
score 100 and quality score 93.

## Post-remediation Paid Arabic retest

| Case | Result | Contract | Quality | Latency | Calls | Cost |
|---|---|---:|---:|---:|---:|---:|
| Clinic SaaS Paid (Arabic) | Passed | 100 | 100 | 112.998s | 3 | $0.186523 |
| Salon Paid (Arabic) | Failed: ungrounded creative-brief visual direction | — | — | 115.999s | 3 | $0.206900 |

The retest confirms that the focused distinctness repair works. It also exposes
the next remaining Paid quality issue: exact offending visual-context text must
be fed back to the repair. The diagnostics and repair prompt now carry that exact
validator finding for the next run.

## Release decision

This sample does **not** meet a production reliability gate:

- Overall pass rate is 45%.
- First-pass success is 0%.
- Paid and Full are below an acceptable launch threshold.
- P95 is close to the route budget, and the maximum exceeded 180 seconds.
- Provider 429s dominate failures under concurrency three.

Organic can remain an internal/beta workflow with explicit repair and failure
receipts, but Paid and Full must not be described as reliably executable yet.

## Required rerun

1. Provision funded provider/Gateway capacity.
2. Queue full-strategy generation at concurrency one until measured capacity
   supports more.
3. Rerun the same 20-case corpus sequentially after the current repairs.
4. Require at least 95% overall success, zero deterministic contract failures,
   and P95 below the production route budget before widening rollout.
5. Keep publishing and paid activation behind their separate user approvals.
