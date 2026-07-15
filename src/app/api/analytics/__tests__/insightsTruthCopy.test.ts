import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/app/api/analytics/insights/route.ts'),
  'utf8',
)

describe('analytics insights runtime copy', () => {
  it('keeps first-user dashboard insights away from launch or activation claims', () => {
    expect(source).toContain('Workspace created — create your first campaign brief to get started')
    expect(source).toContain('No campaigns yet — create your first campaign workspace')
    expect(source).toContain('NEXUS is available — create a campaign workspace when ready')

    expect(source).not.toContain('Workspace ready — create your first campaign to get started')
    expect(source).not.toContain('No campaigns yet — launch your first AI marketing campaign')
    expect(source).not.toContain('create a campaign to activate your marketing engine')
    expect(source).not.toContain('لتشغيل محركك التسويقي')
  })

  it('uses canonical campaign creation links from dashboard insights', () => {
    expect(source).toContain("href: '/campaigns/new'")
    expect(source).not.toContain("href: '/campaign/new'")
  })

  it('frames media and Brand Brain insights as review/setup signals, not automatic execution', () => {
    expect(source).toContain('review media needs before generation')
    expect(source).toContain('Brand voice signals available')
    expect(source).toContain('add your voice before relying on generated strategy')

    expect(source).not.toContain('generate now')
    expect(source).not.toContain('Brand voice active')
    expect(source).not.toContain('campaigns generating without your voice')
    expect(source).not.toContain('currently active')
  })

  it('surfaces a live Brand Brain conflict before maturity claims', () => {
    expect(source).toContain('reviewBrandTruthConsistency')
    expect(source).toContain("id: 'brand-truth-conflict'")
    expect(source).toContain('resolve it before strategy, content, or performance learning continues')
  })
})
