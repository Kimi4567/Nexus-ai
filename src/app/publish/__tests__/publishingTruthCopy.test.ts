import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const publishPageSource = readFileSync(
  resolve(process.cwd(), 'src/app/publish/page.tsx'),
  'utf8',
)

describe('Publishing page execution truth', () => {
  it('labels scheduled records as NEXUS calendar state rather than platform publishing', () => {
    expect(publishPageSource).toContain('NEXUS schedule records')
    expect(publishPageSource).toContain('saved in the NEXUS calendar and not published to a platform')
    expect(publishPageSource).toContain('محفوظ في تقويم NEXUS ولم يُنشر عبر منصة')
    expect(publishPageSource).not.toContain("title={copy('المنشورات المجدولة', 'Scheduled posts')}")
  })

  it('shows every implemented organic publisher in account readiness', () => {
    expect(publishPageSource).toContain("'facebook',\n      'instagram',\n      'tiktok',\n      'linkedin',\n      'x',\n      'threads',\n      'youtube',\n      'pinterest',")
  })
})
