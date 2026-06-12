/**
 * Post-engine (Run Full Strategy) decision logic — Trust & Reliability Sprint #1.
 *
 * The campaign wizard fires POST /api/campaigns/[id]/engine to run the strategy.
 * Previously a failed response was caught by a bare non-fatal catch block and
 * the UI routed to the Content Hub as if the strategy had succeeded.
 *
 * This pure, exhaustive helper makes that impossible: every engine response maps
 * to exactly one explicit outcome, so a failed strategy can never be silently
 * presented as success. Kept side-effect free so it is trivially unit-testable.
 */

export type StrategyOutcome =
  | { kind: 'proceed' }                    // strategy succeeded → continue to content plan / hub
  | { kind: 'upgrade' }                    // 402 — out of credits → show upgrade, do NOT pretend success
  | { kind: 'failed'; refunded: boolean }  // generation failed → show failure state + retry

/**
 * Decide what to do after the /engine call returns.
 *
 * @param status  HTTP status code of the engine response
 * @param ok      response.ok (2xx)
 * @param body    parsed JSON body (may be null/undefined); read `refunded` if present
 */
export function decidePostEngine(
  status: number,
  ok: boolean,
  body: unknown,
): StrategyOutcome {
  if (ok) return { kind: 'proceed' }
  if (status === 402) return { kind: 'upgrade' }

  const refunded =
    !!body &&
    typeof body === 'object' &&
    (body as { refunded?: unknown }).refunded === true

  return { kind: 'failed', refunded }
}
