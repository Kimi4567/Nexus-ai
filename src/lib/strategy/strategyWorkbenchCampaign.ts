import { getStrategyBrandAlignment } from './strategyBrandAlignment'

export interface StrategyWorkbenchCampaignLike {
  id?: string | null
  name?: string | null
  aiOutput?: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strategyFromAiOutput(aiOutput: unknown): Record<string, unknown> | null {
  if (!isObject(aiOutput)) return null
  const strategy = aiOutput.strategy
  return isObject(strategy) ? strategy : aiOutput
}

export function selectStrategyWorkbenchCampaign<T extends StrategyWorkbenchCampaignLike>(
  campaigns: T[],
  currentBrandName?: string | null,
): T | undefined {
  if (!campaigns.length) return undefined
  const brandName = currentBrandName?.trim()
  if (!brandName) return campaigns[0]

  return campaigns.find(campaign => {
    const strategy = strategyFromAiOutput(campaign.aiOutput)
    const alignment = getStrategyBrandAlignment({
      currentBrandName: brandName,
      campaignName: campaign.name,
      strategy,
      aiOutput: isObject(campaign.aiOutput) ? campaign.aiOutput : null,
    })
    return !alignment.isStale
  }) ?? campaigns[0]
}
