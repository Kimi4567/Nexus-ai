import { redirect } from 'next/navigation'

/**
 * Legacy standalone Sentinel route.
 *
 * Competitor intelligence now lives inside Brand Brain, where public-source
 * evidence is reviewed before it can become a separate learning proposal.
 */
export default function SentinelPage() {
  redirect('/brand/competitors')
}
