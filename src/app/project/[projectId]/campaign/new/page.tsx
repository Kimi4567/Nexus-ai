import { redirect } from 'next/navigation'

// This legacy route is superseded by /campaign/new
// Redirect all traffic to the new campaign wizard
export default function LegacyNewCampaignPage() {
  redirect('/campaign/new')
}
