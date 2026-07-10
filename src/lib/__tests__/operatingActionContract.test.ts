import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()

function collectFiles(root: string, suffix: string): string[] {
  const result: string[] = []
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (path.endsWith(suffix)) result.push(path)
    }
  }
  walk(join(ROOT, root))
  return result
}

function readSource(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}

describe('operating action contract', () => {
  it('does not expose native buttons without an action, form behavior, or explicit lock', () => {
    const violations: string[] = []

    for (const path of [...collectFiles('src/app', '.tsx'), ...collectFiles('src/components', '.tsx')]) {
      const source = readFileSync(path, 'utf8')
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

      const visit = (node: ts.Node) => {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(file) === 'button') {
          const names = new Set<string>()
          let hasSpread = false
          let submitsForm = false

          for (const attribute of node.attributes.properties) {
            if (ts.isJsxSpreadAttribute(attribute)) {
              hasSpread = true
              continue
            }
            const attributeName = ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.getText(file)
            names.add(attributeName)
            if (
              attributeName === 'type' &&
              attribute.initializer &&
              ts.isStringLiteral(attribute.initializer) &&
              attribute.initializer.text === 'submit'
            ) {
              submitsForm = true
            }
          }

          const hasContract = hasSpread || submitsForm || names.has('onClick') || names.has('disabled') || names.has('formAction')
          if (!hasContract) {
            const location = file.getLineAndCharacterOfPosition(node.getStart(file))
            violations.push(`${relative(ROOT, path)}:${location.line + 1}`)
          }
        }
        ts.forEachChild(node, visit)
      }

      visit(file)
    }

    expect(violations).toEqual([])
  })

  it('keeps literal internal links pointed at an existing page route', () => {
    const routePatterns = collectFiles('src/app', 'page.tsx').map(path => {
      const directory = relative(join(ROOT, 'src/app'), dirname(path))
      const segments = directory
        .split('/')
        .filter(Boolean)
        .filter(segment => !(segment.startsWith('(') && segment.endsWith(')')))
        .map(segment => {
          if (/^\[\[\.\.\..+\]\]$/.test(segment)) return '(?:/.*)?'
          if (/^\[\.\.\..+\]$/.test(segment)) return '/.+'
          if (/^\[.+\]$/.test(segment)) return '/[^/]+'
          return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
        })
      return new RegExp(`^${segments.join('') || '/'}$`)
    })
    const missing = new Set<string>()

    for (const path of [...collectFiles('src/app', '.tsx'), ...collectFiles('src/components', '.tsx')]) {
      const source = readFileSync(path, 'utf8')
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const visit = (node: ts.Node) => {
        if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'href' && node.initializer) {
          let href: string | null = null
          if (ts.isStringLiteral(node.initializer)) href = node.initializer.text
          if (
            ts.isJsxExpression(node.initializer) &&
            node.initializer.expression &&
            ts.isStringLiteral(node.initializer.expression)
          ) {
            href = node.initializer.expression.text
          }
          if (href?.startsWith('/') && !href.startsWith('/api/')) {
            const pathname = href.split(/[?#]/, 1)[0] || '/'
            if (!routePatterns.some(pattern => pattern.test(pathname))) missing.add(pathname)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(file)
    }

    expect([...missing].sort()).toEqual([])
  })

  it('keeps platform previews read-only and free of invented engagement metrics', () => {
    const source = readSource('src/components/PlatformNativeCard.tsx')

    expect(source).not.toContain('useState')
    expect(source).not.toContain('<button')
    expect(source).not.toContain('parseInt(item.id')
    expect(source).toContain('Analytics after publishing')
    expect(source).toContain('التحليلات بعد النشر')
  })

  it('does not retain query-string generation triggers or stale action destinations', () => {
    const campaignRoom = readSource('src/app/campaigns/[id]/page.tsx')
    const intelligence = readSource('src/lib/marketing-intelligence.ts')

    expect(campaignRoom).not.toContain('actionGeneratePlan')
    expect(campaignRoom).not.toContain("get('action') === 'generate-plan'")
    expect(intelligence).not.toContain('?runStrategy=1')
    expect(intelligence).not.toContain('action=generate-plan')
    expect(intelligence).not.toContain("'/schedule'")
  })

  it('keeps the paid planning wizard localized and explicit about spend assumptions', () => {
    const source = readSource('src/app/paid-campaigns/new/page.tsx')

    expect(source).toContain("copy('اختر منصة التخطيط المدفوع', 'Choose planning platform')")
    expect(source).toContain("copy('نوع افتراض الميزانية', 'Budget Assumption Type')")
    expect(source).toContain("copy('هذا ليس إنفاقاً معتمداً.")
    expect(source).toContain('hasComparableBenchmark')
    expect(source).toContain("data.currency === 'USD'")
    expect(source).toContain("aria-label={copy('العودة إلى مركز الإعلانات المدفوعة'")
    expect(source).not.toContain('>Choose planning platform</h2>')
    expect(source).not.toContain('>Planning Draft Details</h2>')
    expect(source).not.toContain('>Let AI Plan This</span>')
  })
})
