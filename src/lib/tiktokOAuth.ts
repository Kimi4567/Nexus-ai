type TikTokOAuthEnvironment = Record<string, string | undefined>

/**
 * TikTok requires the authorization and token-exchange redirect URI to match
 * the exact value registered on the live app. Keep that provider-specific
 * value independent from the canonical application URL.
 */
export function resolveTikTokRedirectUri(
  baseUrl: string,
  environment: TikTokOAuthEnvironment = process.env,
): string {
  const configured = environment.TIKTOK_REDIRECT_URI?.trim()
  if (configured) return configured

  return `${baseUrl.replace(/\/$/, '')}/api/social/callback/tiktok`
}
