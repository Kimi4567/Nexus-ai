import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = readFileSync(join(process.cwd(), 'src/app/landing-pages/page.tsx'), 'utf8')
const publicPage = [
  readFileSync(join(process.cwd(), 'src/app/lp/[publicId]/page.tsx'), 'utf8'),
  readFileSync(join(process.cwd(), 'src/components/landing-pages/PublicLandingPageClient.tsx'), 'utf8'),
].join('\n')
const qualityGate = readFileSync(join(process.cwd(), 'src/components/landing-pages/LandingPageQualityGate.tsx'), 'utf8')

describe('landing page conversion truth copy', () => {
  it('separates browser reports from server-confirmed form intake in the workspace', () => {
    expect(workspace).toContain('Reported views')
    expect(workspace).toContain('Server-confirmed forms')
    expect(workspace).toContain('Views and clicks are browser signals; form intake is server-confirmed')
    expect(workspace).toContain('WON وقيمة الصفقة يؤكدهما مسؤول داخل CRM')
    expect(workspace).toContain('WON and outcome value are confirmed by a CRM operator')
  })

  it('does not promise contact or commercial outcomes on the public page', () => {
    expect(publicPage).toContain('ولا يضمن تواصلًا أو نتيجة تجارية')
    expect(publicPage).toContain('does not guarantee contact or a commercial outcome')
    expect(publicPage).not.toContain('guaranteed results')
  })

  it('labels the editor review as completeness rather than a ranking or conversion forecast', () => {
    expect(qualityGate).toContain('not an SEO score or a ranking/conversion forecast')
    expect(qualityGate).toContain('لا يثبت lead أو بيعًا أو إيرادًا')
    expect(qualityGate).toContain('Leave it empty instead of inventing a claim')
    expect(workspace).toContain('Save edits before publishing')
    expect(workspace).toContain('Publish saved revision')
  })

  it('offers an explicit archival path that disables public access but retains evidence', () => {
    expect(workspace).toContain('Archive this landing page?')
    expect(workspace).toContain('Public access disabled · history retained')
    expect(workspace).toContain("status: 'ARCHIVED'")
    expect(workspace).toContain('Measurement history is retained')
    expect(workspace).toContain('Confirm archive')
  })
})
