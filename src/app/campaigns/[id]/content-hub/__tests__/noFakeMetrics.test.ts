/**
 * Trust Sprint #6 — Content Hub must not present fabricated engagement metrics.
 *
 * The platform mockups previously shipped fixed fake numbers ("1,234 likes",
 * "View all 42 comments", "1,847", "84 comments", TikTok "142K/1.2K/8.4K") and
 * fake real-time stamps ("Just now", "2 hours ago", "2h ago"). These look like
 * real performance data and damage trust. This source-level guard fails if any of
 * them come back, confirms the honest "preview only" label is used instead, and
 * guards against the PR #4 "Post N for …" placeholder regressing.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
  'utf8',
)

describe('Content Hub — no fake engagement metrics', () => {
  it('1. does not render fabricated like / comment counts', () => {
    expect(SRC).not.toMatch(/1,234 likes/)
    expect(SRC).not.toMatch(/1,847/)
    expect(SRC).not.toMatch(/84 comments/)
    expect(SRC).not.toMatch(/View all \d+ comments/)
    expect(SRC).not.toMatch(/142K/)
    expect(SRC).not.toMatch(/8\.4K/)
    expect(SRC).not.toMatch(/1\.2K/)
  })

  it('1. does not render fabricated "real-time" timestamps as if posts were live', () => {
    expect(SRC).not.toMatch(/Just now/)
    expect(SRC).not.toMatch(/2 hours ago/)
    expect(SRC).not.toMatch(/2h ago/)
  })

  it('2. uses the localized preview-only label instead', () => {
    expect(SRC).toMatch(/contentHub\.previewOnly/)
  })

  it('7. no "Post N for Facebook / Instagram" placeholder regression', () => {
    expect(SRC).not.toMatch(/Post \d+ for/)
    expect(SRC).not.toMatch(/Post \$\{[^}]*\} for/)
  })

  it('6. core post rendering remains intact', () => {
    expect(SRC).toMatch(/function PostCard/)
    expect(SRC).toMatch(/InstagramMockup/)
    expect(SRC).toMatch(/post\.caption/)
  })
})
