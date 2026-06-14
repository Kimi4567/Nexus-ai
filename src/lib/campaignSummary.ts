/**
 * NEXUS — Campaign summary-card counts (pure, testable).
 *
 * The /campaigns summary cards (Total / Active / Drafts) must show the TRUE
 * workspace-wide totals — never the currently-filtered or page-limited subset,
 * and never blank. The API now returns authoritative `counts`; this helper
 * resolves what the cards should display, with a safe fallback to deriving
 * counts from the returned rows when the API omits them (older deploys / error
 * responses).
 *
 * Display-only: no DB, no mutation.
 */

export interface CampaignCounts {
  total: number
  active: number
  draft: number
}

interface CampaignRowLike {
  status?: string | null
}

interface CampaignsApiResponse {
  campaigns?: CampaignRowLike[] | null
  counts?: Partial<CampaignCounts> | null
}

function safeCount(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0
  return Math.trunc(n)
}

/**
 * Resolve the counts to show in the summary cards from an /api/campaigns
 * response. Prefers the authoritative `counts` object; otherwise derives from
 * the returned rows (which may be filtered/limited, so this is a best-effort
 * fallback only).
 */
export function resolveCampaignCounts(data: CampaignsApiResponse | null | undefined): CampaignCounts {
  const c = data?.counts
  if (c && typeof c.total === 'number') {
    return {
      total: safeCount(c.total),
      active: safeCount(c.active),
      draft: safeCount(c.draft),
    }
  }

  const rows = Array.isArray(data?.campaigns) ? data!.campaigns! : []
  return {
    total: rows.length,
    active: rows.filter(r => r?.status === 'ACTIVE').length,
    draft: rows.filter(r => r?.status === 'DRAFT').length,
  }
}
