import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const runtimeSources = [
  'src/lib/email/resend.ts',
  'src/lib/i18n-context.tsx',
  'src/app/schedule/layout.tsx',
  'src/app/api/chat/route.ts',
  'src/app/paid-campaigns/new/page.tsx',
  'src/app/calendar/page.tsx',
  'src/app/vex/page.tsx',
  'src/app/api/ad-campaigns/[id]/generate-copy/route.ts',
].map((path) => [path, readFileSync(path, 'utf8')] as const)

const joinedRuntimeCopy = runtimeSources.map(([, source]) => source).join('\n')

describe('platform execution truth copy', () => {
  it('does not promise automatic publishing or direct go-live from onboarding/runtime copy', () => {
    const forbidden = [
      'Connect your accounts and go live directly from Nexus',
      'Posts go live automatically',
      'Nexus publishes them automatically',
      'NEXUS publishes automatically',
      'publish campaigns directly from NEXUS',
      'publish directly',
      'ready to launch',
      'launch-ready',
      'high-converting',
      'ينشرها تلقائياً',
      'ينشرها تلقائيًا',
      'تنشر الحملات مباشرة من NEXUS',
      'جاهزة للإطلاق',
      'عالية التحويل',
    ]

    for (const phrase of forbidden) {
      expect(joinedRuntimeCopy).not.toContain(phrase)
    }
  })

  it('keeps publishing and paid execution approval-gated in user-facing copy', () => {
    expect(joinedRuntimeCopy).toContain('Nothing publishes or spends without an explicit final action.')
    expect(joinedRuntimeCopy).toContain('Publishing still requires an explicit ready path and confirmation.')
    expect(joinedRuntimeCopy).toContain('publishing or paid execution requires a ready reviewed path and explicit confirmation.')
    expect(joinedRuntimeCopy).toContain('النشر يتطلب مساراً جاهزاً وتأكيداً صريحاً')
  })

  it('frames paid AI help as draft settings, not autonomous execution', () => {
    const paidDraftSource = readFileSync('src/app/paid-campaigns/new/page.tsx', 'utf8')

    expect(paidDraftSource).toContain('Suggest draft settings')
    expect(paidDraftSource).toContain('Draft suggestion')
    expect(paidDraftSource).not.toContain('Let AI Plan This')
    expect(paidDraftSource).not.toContain('AI Suggest →')
  })
})
