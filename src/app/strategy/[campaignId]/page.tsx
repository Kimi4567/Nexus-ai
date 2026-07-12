import { redirect } from 'next/navigation'

export default async function StrategyReviewRedirect(props: { params: Promise<{ campaignId: string }> }) {
  const params = await props.params;
  redirect(`/campaigns/${params.campaignId}?tab=strategy`)
}
