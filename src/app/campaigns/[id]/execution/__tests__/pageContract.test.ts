import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('campaign execution page contract', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/app/campaigns/[id]/execution/page.tsx'), 'utf8')

  it('does not offer organic draft creation for a paid-only campaign', () => {
    expect(source).toContain('!organic.inScope ?')
    expect(source).toContain('No organic work is required')
    expect(source).toContain('organic.inScope && <Link href={`/campaigns/${campaign.id}/content-hub`}')
  })

  it('localizes the paid blockers observed in the Arabic execution journey', () => {
    expect(source).toContain("'creative assets not finalized': 'لم تكتمل الأصول الإبداعية بعد.'")
    expect(source).toContain("'approval for budget allocation pending': 'اعتماد توزيع الميزانية ما زال معلقًا.'")
  })
})
