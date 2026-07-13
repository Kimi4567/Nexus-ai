/**
 * OPS-STATE1B — Content Hub operating-state copy guard.
 *
 * Generation status describes media production only. These source-level checks
 * keep overview and campaign Content Hub labels from implying approval,
 * scheduling, publishing, or completion of the wider content workflow.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const completeWord = 'Com' + 'plete'
const readySuffix = ['R', 'eady'].join('')
const readyKey = `contentHub.filter${readySuffix}`
const genericStatusKey = `contentHub.status${readySuffix}`
const publishingWindow = 'Publishing' + ' window'

const OVERVIEW_SRC = readFileSync(
  resolve(process.cwd(), 'src/app/content-hub/page.tsx'),
  'utf8',
)

const CAMPAIGN_SRC = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
  'utf8',
)

const MEDIA_STATE_SRC = readFileSync(
  resolve(process.cwd(), 'src/lib/contentHubMediaState.ts'),
  'utf8',
)

describe('Content Hub operating-state copy', () => {
  it('classifies overview media from the saved source without calling it complete', () => {
    expect(OVERVIEW_SRC).not.toContain(`'${completeWord}'`)
    expect(OVERVIEW_SRC).not.toContain(`"${completeWord}"`)
    expect(OVERVIEW_SRC).not.toContain(`\`${completeWord}\``)
    expect(OVERVIEW_SRC).toContain('deriveContentHubMediaState')
    expect(OVERVIEW_SRC).toContain('isContentPostMediaReadyForScheduling')
    expect(MEDIA_STATE_SRC).toMatch(/Generated image/)
    expect(MEDIA_STATE_SRC).toMatch(/Uploaded asset/)
    expect(MEDIA_STATE_SRC).toMatch(/No media/)
    expect(MEDIA_STATE_SRC).toMatch(/needs a media decision/)
  })

  it('does not invent generic CTA choices outside campaign and post evidence', () => {
    expect(OVERVIEW_SRC).toContain('CTA is reviewed per post')
    expect(OVERVIEW_SRC).toContain('NEXUS does not assume a generic CTA here')
    expect(OVERVIEW_SRC).not.toContain("['Shop now', 'Explore collection', 'Book a consultation']")
  })

  it('does not use generic ready copy for generationStatus DONE', () => {
    expect(CAMPAIGN_SRC).not.toContain(`DONE: t('${genericStatusKey}')`)
    expect(CAMPAIGN_SRC).not.toContain(readyKey)
    expect(CAMPAIGN_SRC).toMatch(/Media ready/)
  })

  it('uses publishing-window copy only for actually scheduled results', () => {
    expect(CAMPAIGN_SRC).toContain(`approveResult.kind === 'scheduled' ? '${publishingWindow}' : 'Planned content window'`)
    expect(CAMPAIGN_SRC).toMatch(/approved posts are not linked/)
    expect(CAMPAIGN_SRC).not.toMatch(/enable auto-publishing/)
  })

  it('counts scheduled content only when scheduledAt is valid', () => {
    expect(CAMPAIGN_SRC).toContain('function hasValidDate')
    expect(CAMPAIGN_SRC).toContain("p.status === 'SCHEDULED' && hasValidDate(p.scheduledAt)")
    expect(CAMPAIGN_SRC).not.toContain("const scheduledCount = posts.filter(p => p.status === 'SCHEDULED').length")
  })
})
