import { redirect } from 'next/navigation'

/**
 * Legacy standalone Sentinel route.
 *
 * Market intelligence and performance review now live in Analytics and
 * campaign-level strategy surfaces, where evidence boundaries are explicit.
 */
export default function SentinelPage() {
  redirect('/analytics')
}
