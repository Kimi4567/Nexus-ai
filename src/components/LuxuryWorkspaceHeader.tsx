'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import {
  getMarketingJourneyStage,
  type MarketingJourneyStageId,
} from '@/lib/marketingJourney'

interface LuxuryWorkspaceHeaderProps {
  pageTitle?: string
  pageSubtitle?: string
  primaryHref?: string | null
  primaryLabel?: string
  secondaryHref?: string | null
  secondaryLabel?: string
  journeyStage?: MarketingJourneyStageId
}

/**
 * Shared workspace header.
 *
 * The old header mixed page identity, search, notifications, account details,
 * and three competing actions. This version keeps one job: tell the user where
 * they are and what the primary action on this page is.
 */
export default function LuxuryWorkspaceHeader({
  pageTitle,
  pageSubtitle,
  primaryHref = '/strategy',
  primaryLabel,
  secondaryHref = '/brand',
  secondaryLabel,
  journeyStage,
}: LuxuryWorkspaceHeaderProps) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const resolvedPrimaryLabel = primaryLabel || (ar ? 'عمل جديد' : 'New work')
  const resolvedSecondaryLabel = secondaryLabel || (ar ? 'Brand Brain' : 'Brand Brain')
  const stage = journeyStage ? getMarketingJourneyStage(journeyStage) : null

  return (
    <header
      dir={ar ? 'rtl' : 'ltr'}
      className="nx-os-workspace-header nx-os-rule mb-5 border-b pb-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="nx-ai-chip mb-3">
            <span className="nx-ai-core" aria-hidden="true" />
            <span>
              {stage
                ? (ar
                    ? `المرحلة ${stage.step} من 5 · ${stage.label.ar}`
                    : `Step ${stage.step} of 5 · ${stage.label.en}`)
                : (ar ? 'مساحة عمل NEXUS' : 'NEXUS workspace')}
            </span>
          </div>
          <h1 className="nx-workspace-title leading-tight">
            {pageTitle || (ar ? 'نظام التسويق الذكي' : 'AI Marketing OS')}
          </h1>
          {pageSubtitle ? (
            <p className="nx-workspace-copy mt-1.5 max-w-3xl">
              {pageSubtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="nx-workspace-button"
            >
              {resolvedSecondaryLabel}
            </Link>
          ) : null}
          {primaryHref ? (
            <Link
              href={primaryHref}
              className="nx-workspace-button-primary"
            >
              {resolvedPrimaryLabel}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  )
}
