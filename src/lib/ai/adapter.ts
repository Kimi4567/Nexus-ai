import * as realAI from './openai'
import * as mockAI from './mock'

const useMock = !process.env.OPENAI_API_KEY

export const generateScript = async (briefing: string) => {
  if (useMock) return mockAI.generateScript(briefing)
  return realAI.generateScript(briefing)
}

export const generateCaptions = async (script: string, platform: string) => {
  if (useMock) return mockAI.generateCaptions(script, platform)
  return realAI.generateCaptions(script, platform)
}

export const callOpenAI = async (prompt: string) => {
  if (useMock) return mockAI.callOpenAI(prompt)
  return realAI.callOpenAI(prompt)
}

export const generateMarketingStrategy = async (campaign: any, project: any) => {
  if (useMock) return mockAI.generateMarketingStrategy(campaign, project)
  // realAI strategy is implemented in strategy.ts and calls openai directly
  return realAI.generateMarketingStrategy(campaign as any, project as any)
}

export const generateAdConcepts = async (campaign: any, project: any) => {
  if (useMock) return mockAI.generateAdConcepts(campaign, project)
  return realAI.generateAdConcepts(campaign as any, project as any)
}

export default {
  generateScript,
  generateCaptions,
  callOpenAI,
  generateMarketingStrategy,
  generateAdConcepts,
}
