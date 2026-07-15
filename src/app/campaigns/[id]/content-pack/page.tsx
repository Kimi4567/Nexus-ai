import { redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

/**
 * Legacy compatibility route.
 *
 * Content Hub is the only source of truth for campaign posts. Keeping a
 * second, aiOutput-derived "Content Pack" allowed stale strategy drafts to be
 * mistaken for the reviewed post plan, so old bookmarks now land on the
 * authoritative campaign content workspace.
 */
export default async function LegacyContentPackPage({ params }: Props) {
  const { id } = await params
  redirect(`/campaigns/${encodeURIComponent(id)}/content-hub`)
}
