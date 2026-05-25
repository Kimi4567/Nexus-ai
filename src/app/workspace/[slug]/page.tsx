import { redirect } from 'next/navigation'

// This legacy workspace route is superseded by the main dashboard
// Redirect all traffic to the dashboard
export default function LegacyWorkspacePage() {
  redirect('/dashboard')
}
