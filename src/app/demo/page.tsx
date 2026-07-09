import { redirect } from 'next/navigation'

/**
 * Legacy demo route.
 *
 * The production product should lead users into the live dashboard, not a
 * separate sample-data surface that can be confused with real performance.
 */
export default function DemoPage() {
  redirect('/dashboard')
}
