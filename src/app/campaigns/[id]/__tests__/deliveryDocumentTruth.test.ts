import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const documentPage = readFileSync(join(process.cwd(), 'src/app/campaigns/[id]/print/page.tsx'), 'utf8')
const campaignPage = readFileSync(join(process.cwd(), 'src/app/campaigns/[id]/page.tsx'), 'utf8')

describe('campaign delivery document truth', () => {
  it('shows approval and provider boundaries before allowing print-to-PDF', () => {
    expect(documentPage).toContain('/delivery-package')
    expect(documentPage).toContain('Review draft — not approved for execution')
    expect(documentPage).toContain('does not prove provider permission, publication, spend, or performance')
    expect(documentPage).toContain('provider publications verified')
    expect(campaignPage).toContain('Open delivery document')
    expect(campaignPage).not.toContain("cdT?.btnExportPdf || 'Export PDF'")
  })
})
