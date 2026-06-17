'use client'

/**
 * BrandDNABadge — shows which Brand Brain attributes powered an AI output.
 *
 * Placed at the top of each AI-generated section (Strategy, Content Pack,
 * Creative Brief) so the user can see their brand memory at work.
 *
 * Design: thin frosted bar with teal DNA icon + colored attribute chips.
 */

import { Dna } from 'lucide-react'
import Link from 'next/link'

export interface BrandDNAData {
  brandName?: string | null
  industry?: string | null
  toneKeywords?: string[]
  writingStyle?: string | null
  targetAudience?: string | null
  audienceAge?: string | null
  topPlatforms?: string[]
  pricePoint?: string | null
  uniqueAdvantages?: string[]
  audiencePainPoints?: string[]
}

interface Props {
  brand: BrandDNAData | null
  locale?: string
}

const ATTRIBUTE_CONFIG: Array<{
  key: keyof BrandDNAData
  labelAr: string
  labelEn: string
  color: string   // Tailwind-free inline hex
  getValue: (b: BrandDNAData) => string | null
}> = [
  {
    key: 'brandName',
    labelAr: 'العلامة', labelEn: 'Brand',
    color: '#f59e0b',
    getValue: b => b.brandName || null,
  },
  {
    key: 'industry',
    labelAr: 'القطاع', labelEn: 'Industry',
    color: '#06b6d4',
    getValue: b => b.industry || null,
  },
  {
    key: 'toneKeywords',
    labelAr: 'النبرة', labelEn: 'Tone',
    color: '#8b5cf6',
    getValue: b => b.toneKeywords?.slice(0, 2).join(' · ') || null,
  },
  {
    key: 'targetAudience',
    labelAr: 'الجمهور', labelEn: 'Audience',
    color: '#ec4899',
    getValue: b => b.targetAudience ? b.targetAudience.slice(0, 35) + (b.targetAudience.length > 35 ? '…' : '') : null,
  },
  {
    key: 'topPlatforms',
    labelAr: 'المنصات', labelEn: 'Platforms',
    color: '#10b981',
    getValue: b => b.topPlatforms?.slice(0, 3).join(' · ') || null,
  },
  // PR-J — price tier intentionally NOT surfaced as a "Brand DNA" fact here.
  // pricePoint is often AI-inferred (website scan) rather than user-confirmed, so
  // showing a single word like "luxury" read as verified truth. It still lives in
  // Brand Brain for the user to set; we just don't present it as authoritative DNA.
]

export default function BrandDNABadge({ brand, locale = 'ar' }: Props) {
  if (!brand || !brand.brandName) return null

  const ar = locale === 'ar'
  const activeChips = ATTRIBUTE_CONFIG
    .map(a => ({ ...a, value: a.getValue(brand) }))
    .filter(a => a.value !== null)

  if (activeChips.length === 0) return null

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl mb-5 flex-wrap"
      style={{
        background: 'rgba(16,185,129,0.04)',
        border: '1px solid rgba(16,185,129,0.18)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Icon + label */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
        >
          <Dna size={14} style={{ color: '#10b981' }} />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#10b981' }}>
          {ar ? 'بُني بذاكرة علامتك' : 'Built from your Brand DNA'}
        </span>
      </div>

      {/* Attribute chips */}
      <div className="flex flex-wrap items-center gap-1.5 flex-1">
        {activeChips.map(chip => (
          <span
            key={chip.key}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
            style={{
              background: `${chip.color}12`,
              border: `1px solid ${chip.color}30`,
              color: chip.color,
            }}
          >
            <span style={{ opacity: 0.6, fontSize: 9 }}>
              {ar ? chip.labelAr : chip.labelEn}
            </span>
            <span>{chip.value}</span>
          </span>
        ))}
      </div>

      {/* Edit link */}
      <Link
        href="/brand"
        className="text-[10px] font-semibold flex-shrink-0 transition-colors"
        style={{ color: 'rgba(16,185,129,0.5)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#10b981' }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(16,185,129,0.5)' }}
      >
        {ar ? '← تعديل' : 'Edit →'}
      </Link>
    </div>
  )
}
