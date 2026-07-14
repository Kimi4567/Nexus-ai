export function isContentHubYouTubeShortsPlatform(platform?: string | null): boolean {
  const normalized = (platform || '').trim().toUpperCase()
  return normalized === 'YOUTUBE' || normalized === 'YOUTUBE_SHORTS'
}

export function normalizeContentHubImagePromptForPlatform(prompt: string, platform?: string | null): string {
  const cleanPrompt = prompt.replace(/\s+/g, ' ').trim()
  if (!cleanPrompt) return cleanPrompt
  const normalized = (platform || '').trim().toUpperCase()
  const isPinterest = normalized === 'PINTEREST'
  if (!isContentHubYouTubeShortsPlatform(platform) && !isPinterest) return cleanPrompt

  const platformFormatPattern = /\b(?:square\s+1:1|wide\s+horizontal\s+1\.91:1|vertical\s+4:5|vertical\s+9:16|vertical\s+2:3|horizontal\s+16:9)\s+composition\b/i
  const requiredFormat = isPinterest ? 'vertical 2:3 composition' : 'vertical 9:16 composition'
  if (platformFormatPattern.test(cleanPrompt)) {
    return cleanPrompt.replace(platformFormatPattern, requiredFormat)
  }

  if (isPinterest ? /vertical\s+2:3/i.test(cleanPrompt) : /vertical\s+9:16/i.test(cleanPrompt)) return cleanPrompt

  return `${requiredFormat}; ${cleanPrompt}`
}
