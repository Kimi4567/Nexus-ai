import * as realAI from './openai'
import { assertAiProviderConfigured } from './provider'

export const generateScript = async (briefing: string) => {
  assertAiProviderConfigured()
  return realAI.generateScript(briefing)
}

export const generateCaptions = async (script: string, platform: string) => {
  assertAiProviderConfigured()
  return realAI.generateCaptions(script, platform)
}

export const callOpenAI = async (prompt: string) => {
  assertAiProviderConfigured()
  return realAI.callOpenAI(prompt)
}

export const generateMarketingStrategy = async (campaign: any, project: any) => {
  assertAiProviderConfigured()
  // realAI strategy is implemented in strategy.ts and calls openai directly
  return realAI.generateMarketingStrategy(campaign as any, project as any)
}

export const generateAdConcepts = async (campaign: any, project: any) => {
  assertAiProviderConfigured()
  return realAI.generateAdConcepts(campaign as any, project as any)
}

export default {
  generateScript,
  generateCaptions,
  callOpenAI,
  generateMarketingStrategy,
  generateAdConcepts,
}
