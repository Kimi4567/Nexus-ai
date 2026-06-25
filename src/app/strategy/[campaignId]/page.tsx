import { redirect } from 'next/navigation'

export default function StrategyReviewRedirect({ params }: { params: { campaignId: string } }) {
  redirect(`/campaigns/${params.campaignId}?tab=strategy`)
}
