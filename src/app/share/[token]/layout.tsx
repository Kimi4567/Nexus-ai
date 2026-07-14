/**
 * Server component layout for /share/[token]
 * Generates dynamic OG metadata from the campaign share token.
 */
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-grow.com'

const GOAL_LABELS: Record<string, string> = {
  SALES: 'Sales Campaign',
  AWARENESS: 'Brand Awareness Campaign',
  LEADS: 'Lead Generation Campaign',
  TRAFFIC: 'Traffic Campaign',
  ENGAGEMENT: 'Engagement Campaign',
  BRAND_BUILDING: 'Brand Building Campaign',
}

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params;
  const campaign = await prisma.campaign.findFirst({
    where: { shareToken: params.token, isPublic: true },
    select: {
      name: true,
      goal: true,
      platforms: true,
      tone: true,
      project: {
        select: { workspace: { select: { name: true } } },
      },
    },
  }).catch(() => null)

  if (!campaign) {
    return {
      title: 'Campaign Not Found — Nexus AI',
      description: 'This campaign link has been revoked or does not exist.',
    }
  }

  const goalLabel = GOAL_LABELS[campaign.goal] || campaign.goal
  const platformList = (campaign.platforms || []).join(', ').replace(/_/g, ' ')
  const workspaceName = campaign.project?.workspace?.name || 'Nexus AI'

  const title = `${campaign.name} — ${goalLabel} by ${workspaceName}`
  const channelContext = platformList || 'saved channels'
  const description = `Reviewable ${goalLabel.toLowerCase()} draft for ${channelContext}, grounded in the workspace Brand Brain and built with Nexus AI.`
  const ogImageUrl = `${APP_URL}/api/og/share?token=${params.token}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${APP_URL}/share/${params.token}`,
      siteName: 'Nexus AI',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
