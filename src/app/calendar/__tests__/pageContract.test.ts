import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'src/app/calendar/page.tsx'), 'utf8')

describe('Execution page contract', () => {
  it('redirects signed-out users instead of leaving a blank execution page', () => {
    expect(source).toContain("if (!loading && !isAuthenticated) router.push('/auth/login')")
  })

  it('uses the deterministic execution queue as its decision source', () => {
    expect(source).toContain("fetch('/api/execution/queue'")
    expect(source).toContain('nextExecutionAction')
    expect(source).toContain('journeyStage="execution"')
  })

  it('keeps the Brand Brain safety lock without duplicating its repair action', () => {
    expect(source).toContain("primaryHref={calendarTruthFailure ? '/brand' : calendarTruthLocked ? null")
    expect(source).toContain("activeTab === 'queue' && !calendarTruthLocked")
    expect(source).toContain('calendarTruthFailure &&')
    expect(source).not.toContain("href={calendarTruthLocked ? '/brand' : '/content-hub'}")
  })

  it('shows the exact post destination, localized lifecycle, and truthful relative time', () => {
    expect(source).toContain('post.publishTarget || post.platform')
    expect(source).toContain('t(statusLabelKey(post))')
    expect(source).toContain('formatScheduledTimeDistance(post.scheduledAt, locale)')
    expect(source).not.toContain('post.status.toLowerCase()')
    expect(source).toContain('قرارات التشغيل المجمّعة')
  })
})
