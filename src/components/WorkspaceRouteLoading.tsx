'use client'

import AppShell from '@/components/AppShell'
import { useI18n } from '@/lib/i18n-context'

interface WorkspaceRouteLoadingProps {
  labelAr?: string
  labelEn?: string
  descriptionAr?: string
  descriptionEn?: string
  framed?: boolean
}

function LoadingSurface({
  labelAr,
  labelEn,
  descriptionAr,
  descriptionEn,
}: Omit<WorkspaceRouteLoadingProps, 'framed'>) {
  const { locale, dir } = useI18n()
  const isArabic = locale === 'ar'

  return (
    <section
      dir={dir}
      className="nx-workspace-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="nx-workspace-loading__core" aria-hidden="true">
        <span className="nx-ai-core" />
      </div>
      <div className="min-w-0">
        <p className="nx-workspace-loading__eyebrow">NEXUS MARKETING OS</p>
        <p className="nx-workspace-loading__title">
          {isArabic ? (labelAr ?? 'جارٍ تجهيز مساحة العمل') : (labelEn ?? 'Preparing your workspace')}
        </p>
        <p className="nx-workspace-loading__copy">
          {isArabic
            ? (descriptionAr ?? 'نسترجع الحالة المحفوظة من دون إنشاء محتوى أو تنفيذ أي إجراء.')
            : (descriptionEn ?? 'Restoring saved state without generating content or taking any action.')}
        </p>
      </div>
      <span className="nx-workspace-loading__progress" aria-hidden="true" />
    </section>
  )
}

export default function WorkspaceRouteLoading({ framed = true, ...copy }: WorkspaceRouteLoadingProps) {
  const content = (
    <main className="nx-os-page">
      <div className="nx-os-container nx-workspace-loading-wrap">
        <LoadingSurface {...copy} />
      </div>
    </main>
  )

  return framed ? <AppShell>{content}</AppShell> : content
}
