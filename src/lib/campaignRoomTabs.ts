export const CAMPAIGN_ROOM_TAB_KEYS = [
  'strategy',
  'content',
  'calendar',
  'creative',
  'publish',
  'autopilot',
  'performance',
] as const

export type CampaignRoomTabKey = typeof CAMPAIGN_ROOM_TAB_KEYS[number]

const CAMPAIGN_ROOM_TAB_ALIASES: Record<string, CampaignRoomTabKey> = {
  visuals: 'creative',
}

export function normalizeCampaignRoomTab(value?: string | null): CampaignRoomTabKey {
  const raw = value?.trim().toLowerCase()
  if (!raw) return 'strategy'

  if ((CAMPAIGN_ROOM_TAB_KEYS as readonly string[]).includes(raw)) {
    return raw as CampaignRoomTabKey
  }

  return CAMPAIGN_ROOM_TAB_ALIASES[raw] || 'strategy'
}

export function campaignRoomTabIndexFromQuery(value?: string | null): number {
  return CAMPAIGN_ROOM_TAB_KEYS.indexOf(normalizeCampaignRoomTab(value))
}

export function campaignRoomTabKeyFromIndex(index: number): CampaignRoomTabKey {
  return CAMPAIGN_ROOM_TAB_KEYS[index] || 'strategy'
}
