import { redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

/**
 * Legacy compatibility route.
 *
 * The former execution package duplicated strategy state and could disagree
 * with the campaign room. Keep old links working, but route them to the single
 * current printable campaign document instead of maintaining a second truth.
 */
export default async function LegacyExecutionPackagePage({ params }: Props) {
  const { id } = await params
  redirect(`/campaigns/${encodeURIComponent(id)}/print`)
}
