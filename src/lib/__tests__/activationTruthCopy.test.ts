import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const runtimeFiles = [
  'src/lib/i18n-context.tsx',
  'src/lib/brandReadiness.ts',
  'src/lib/firstUserJourney.ts',
  'src/app/campaigns/new/page.tsx',
  'src/app/studio/page.tsx',
  'src/app/sentinel/page.tsx',
  'src/components/StrategicVerdictCard.tsx',
  'src/lib/strategy/deliverablesContract.ts',
]

const readRuntime = () =>
  runtimeFiles
    .map((file) => `${file}\n${readFileSync(path.join(process.cwd(), file), 'utf8')}`)
    .join('\n\n')

describe('activation truth runtime copy', () => {
  it('does not use activation or all-agents language for Brand Brain context', () => {
    const source = readRuntime()

    expect(source).not.toMatch(/Activate Brand Brain|Save & Activate Brain|activateBrain/)
    expect(source).not.toMatch(/Brand Brain is ready|brand brain is ready/i)
    expect(source).not.toMatch(/all agents (will use|know)/i)
    expect(source).not.toMatch(/فعّل Brand Brain|حفظ وتفعيل Brain|كل الوكلاء/)
    expect(source).not.toMatch(/جاهزون للإطلاق|وكلاؤك جاهزون|نظام التسويق جاهز/)
  })

  it('does not frame strategy or content planning as activation', () => {
    const source = readRuntime()

    expect(source).not.toMatch(/before activation|Campaign activation|activate your marketing system/i)
    expect(source).not.toMatch(/تحريك منظومتك التسويقية|قبل التفعيل/)
  })

  it('uses safer context, review, and explicit execution language instead', () => {
    const source = readRuntime()

    expect(source).toContain('Set up Brand Brain')
    expect(source).toContain('Save Brand Brain')
    expect(source).toContain('Core profile available')
    expect(source).toContain('Brand Brain core context is available')
    expect(source).toContain('create a content plan for review before any scheduling or publishing')
    expect(source).toContain('before paid execution')
    expect(source).toContain('Campaign execution')
    expect(source).toContain('إعداد Brand Brain')
    expect(source).toContain('حفظ Brand Brain')
    expect(source).toContain('ملف أساسي متاح')
    expect(source).toContain('قبل أي جدولة أو نشر')
  })
})
