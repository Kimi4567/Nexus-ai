import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
  'utf8',
)

describe('Content Hub filtered empty state', () => {
  it('explains zero matching results and provides a filter reset action', () => {
    expect(source).toContain("posts.length > 0 && filteredPosts.length === 0 && !generatingPlan")
    expect(source).toContain('لا توجد منشورات تطابق هذه الفلاتر')
    expect(source).toContain("setActivePlatform('ALL')")
    expect(source).toContain("setStatusFilter('ALL')")
  })
})
