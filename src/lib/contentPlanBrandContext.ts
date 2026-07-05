interface BrandProfileLike {
  brandName?: unknown
}

interface WorkspaceLike {
  name?: unknown
  brandProfile?: BrandProfileLike | null
}

interface CampaignLike {
  name?: unknown
  workspace?: WorkspaceLike | null
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function extractBrandFromCampaignName(name: string): string {
  const patterns = [
    /\bfor\s+(.+)$/i,
    /(?:^|\s)لـ\s*([^|—–-]+)\s*$/i,
    /(?:^|\s)ل\s+([^|—–-]+)\s*$/i,
  ]
  for (const pattern of patterns) {
    const match = name.match(pattern)?.[1]?.trim()
    if (match) return match
  }
  return ''
}

/**
 * Content plans are brand-facing artifacts. Workspace names can be owner or
 * account names, so prefer Brand Brain's explicit brandName before falling back
 * to campaign naming and finally the workspace name.
 */
export function resolveContentPlanBrandName(campaign: CampaignLike): string {
  const profileName = clean(campaign.workspace?.brandProfile?.brandName)
  if (profileName) return profileName

  const campaignName = clean(campaign.name)
  const campaignBrand = extractBrandFromCampaignName(campaignName)
  if (campaignBrand) return campaignBrand

  const workspaceName = clean(campaign.workspace?.name)
  return workspaceName || 'Brand'
}
