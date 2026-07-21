import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'src/app/leads/page.tsx'), 'utf8')
const sidebar = readFileSync(join(process.cwd(), 'src/components/Sidebar.tsx'), 'utf8')

describe('lead CRM product truth', () => {
  it('exposes CRM navigation while keeping migration and automation boundaries explicit', () => {
    expect(sidebar).toContain("href: '/leads'")
    expect(page).toContain('LEADS_CRM_ENABLED=false')
    expect(page).toContain('outreachAutomation=false')
    expect(page).toContain('No messages or calls are automated.')
    expect(page).toContain('Demo numbers are never shown as results.')
  })
})
