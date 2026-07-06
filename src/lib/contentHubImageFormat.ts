export function isContentHubYouTubeShortsPlatform(platform?: string | null): boolean {
  const normalized = (platform || '').trim().toUpperCase()
  return normalized === 'YOUTUBE' || normalized === 'YOUTUBE_SHORTS'
}

export function normalizeContentHubImagePromptForPlatform(prompt: string, platform?: string | null): string {
  const cleanPrompt = prompt.replace(/\s+/g, ' ').trim()
  if (!cleanPrompt || !isContentHubYouTubeShortsPlatform(platform)) return cleanPrompt

  const platformFormatPattern = /\b(?:square\s+1:1|wide\s+horizontal\s+1\.91:1|vertical\s+4:5|horizontal\s+16:9)\s+composition\b/i
  if (platformFormatPattern.test(cleanPrompt)) {
    return cleanPrompt.replace(platformFormatPattern, 'vertical 9:16 composition')
  }

  if (/vertical\s+9:16/i.test(cleanPrompt)) return cleanPrompt

  return `vertical 9:16 composition; ${cleanPrompt}`
}
