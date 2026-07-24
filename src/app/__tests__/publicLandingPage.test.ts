import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'src/app/page.tsx'), 'utf8')
const i18nProvider = readFileSync(resolve(process.cwd(), 'src/lib/i18n-context.tsx'), 'utf8')

describe('public landing-page contract', () => {
  it('defaults new visitors to English while preserving the Arabic switch', () => {
    expect(i18nProvider).toContain("useState<Locale>('en')")
    expect(i18nProvider).toContain("setLocaleState('en')")
    expect(page).toContain("lang === 'ar'")
    expect(page).toContain("ar ? 'English' : 'العربية'")
  })

  it('sells the complete existing operating system around Brand Brain', () => {
    expect(page).toContain('One Brand Brain.')
    expect(page).toContain('Brand & competitor intelligence')
    expect(page).toContain('Strategy & campaigns')
    expect(page).toContain('Content & media production')
    expect(page).toContain('Review & approvals')
    expect(page).toContain('Execution & delivery')
    expect(page).toContain('Landing pages & conversion')
    expect(page).toContain('Leads & follow-up')
    expect(page).toContain('Analytics & learning')
  })

  it('states the real execution, monitoring, and learning boundaries', () => {
    expect(page).toContain('No external publishing or ad spend without a connected platform')
    expect(page).toContain('Checks public pages every 24 hours')
    expect(page).toContain('use no AI and deduct no credits')
    expect(page).toContain('only enter permanent memory after you accept them')
    expect(page).toContain('Internal scheduling is not publishing')
  })

  it('does not reuse fabricated dashboard artwork or make unsupported performance claims', () => {
    expect(page).not.toContain('hero-dashboard.webp')
    expect(page).not.toContain('dashboard-hero.webp')
    expect(page).not.toMatch(/\+\d+%|\d+x\s+(?:ROI|growth|faster)/i)
    expect(page).not.toContain('trusted by')
  })
})
