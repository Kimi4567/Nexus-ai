'use client'

/**
 * Strategy PR-2B2C — Derived Strategic Verdict + Top 3 Decisions.
 *
 * 100% client-side DERIVATION from already-saved strategy + Brand Brain + readiness
 * data. No generation, no OpenAI, no new fields. The verdict is template-assembled
 * from existing slots — if the inputs are too sparse or the result would be awkward,
 * it falls back to a calm honest line rather than forcing a "smart" sentence.
 *
 * Paid honesty: the verdict never implies paid is active / will launch / will spend.
 * Paid only ever appears as planning that needs prerequisites before paid execution.
 */

export type VerdictLocale = 'en' | 'ar'

export interface VerdictInput {
  locale: VerdictLocale
  positioning?: string | null
  keyMessage?: string | null
  differentiation?: string | null
  targetAudienceRefined?: string | null
  topSegment?: string | null            // audienceSegmentsDetailed[0].segment
  audienceLocation?: string | null       // brandDNA.audienceLocation
  /** PR-2B1 server-authoritative readiness (absent on old strategies). */
  confidenceReport?: { overall?: string; byCapability?: Record<string, string> } | null
  missingDataKeys?: string[]
  hasFunnel?: boolean
  kpisAreHypotheses?: boolean
}

const L = (lo: string, en: string, ar: string) => (lo === 'ar' ? ar : en)

/** Join a list with a natural "A, B, and C" (Oxford) / "A، B، وC" in Arabic. */
function joinAnd(parts: string[], lo: string): string {
  if (parts.length <= 1) return parts[0] || ''
  if (parts.length === 2) return L(lo, `${parts[0]} and ${parts[1]}`, `${parts[0]} و${parts[1]}`)
  const head = parts.slice(0, -1).join(L(lo, ', ', '، '))
  const last = parts[parts.length - 1]
  return L(lo, `${head}, and ${last}`, `${head}، و${last}`)
}

const FALLBACK = (lo: string) =>
  L(lo,
    'Strategy direction is available, but more Brand Brain data is needed to make it sharper.',
    'الاتجاه الاستراتيجي متاح، لكن يلزم إضافة بيانات أكثر في Brand Brain لجعله أدق.')

/** Trim a field to a short, clean clause; returns '' if not usable. */
function clause(s?: string | null, max = 90): string {
  if (!s || typeof s !== 'string') return ''
  const t = s.trim().replace(/\s+/g, ' ')
  if (t.length < 4) return ''
  // Use the first sentence; cap length to keep the verdict short.
  const first = t.split(/(?<=[.!?])\s/)[0]
  const out = (first || t).slice(0, max).trim()
  return out.replace(/[.!?]+$/, '')
}

/** Which paid prerequisites are missing (for the honest paid clause). */
function missingPaidPrereqs(lo: string, keys: string[]): string[] {
  const labels: Record<string, { en: string; ar: string }> = {
    marketingBudget: { en: 'budget', ar: 'الميزانية' },
    conversionDestination: { en: 'conversion data', ar: 'وجهة التحويل' },
    pixel: { en: 'tracking', ar: 'التتبع' },
  }
  return ['marketingBudget', 'conversionDestination', 'pixel']
    .filter(k => keys.includes(k))
    .map(k => L(lo, labels[k].en, labels[k].ar))
}

/**
 * Build a one-line strategic verdict from existing fields only.
 * Returns the fallback line when audience + a usable angle can't both resolve.
 */
export function deriveStrategicVerdict(input: VerdictInput): { text: string; isFallback: boolean } {
  const lo = input.locale
  const audience = clause(input.topSegment, 60) || clause(input.targetAudienceRefined, 60)
  const angle = clause(input.positioning, 90) || clause(input.differentiation, 90) || clause(input.keyMessage, 90)

  // Insufficient data → calm fallback (never force a sentence).
  if (!audience || !angle) return { text: FALLBACK(lo), isFallback: true }

  const loc = clause(input.audienceLocation, 40)
  const audiencePart = loc ? L(lo, `${audience} in ${loc}`, `${audience} في ${loc}`) : audience

  // Paid clause — honest, never implies activation/launch/spend.
  const paidReady = input.confidenceReport?.byCapability?.paidStrategy === 'high'
  let paidClause = ''
  if (input.confidenceReport && !paidReady) {
    const needs = missingPaidPrereqs(lo, input.missingDataKeys || [])
    const needsTxt = needs.length
      ? joinAnd(needs, lo)
      : L(lo, 'more data', 'بيانات إضافية')
    paidClause = L(lo,
      ` — paid planning needs ${needsTxt} before paid execution`,
      ` — يحتاج تخطيط المدفوع إلى ${needsTxt} قبل أي تنفيذ مدفوع`)
  }

  const core = L(lo,
    `Win ${audiencePart} with trust-led organic content first`,
    `اكسب ${audiencePart} عبر محتوى عضوي قائم على الثقة أولاً`)

  let text = `${core}${paidClause}.`
  // Quality guard: if it ends up too long, drop the paid clause; if still long, fallback.
  if (text.length > 180) text = `${core}.`
  if (text.length > 180) return { text: FALLBACK(lo), isFallback: true }
  return { text, isFallback: false }
}

export interface Decision { key: string; text: string }

/**
 * Up to 3 strategic decisions derived from existing state. Strategic framing only —
 * never tasks/execution, never duplicates the Action Card primary.
 */
export function deriveTopDecisions(input: VerdictInput): Decision[] {
  const lo = input.locale
  const keys = input.missingDataKeys || []
  const paidReady = input.confidenceReport?.byCapability?.paidStrategy === 'high'
  const out: Decision[] = []

  // 1. Organic-first posture (whenever paid isn't ready, which is the norm today).
  if (!paidReady) {
    out.push({ key: 'organic', text: L(lo, 'Lead with organic, trust-led content first.', 'ابدأ بمحتوى عضوي قائم على الثقة أولاً.') })
  }
  // 2. Hold paid until prerequisites exist.
  if (!paidReady && (keys.includes('marketingBudget') || keys.includes('conversionDestination') || keys.includes('pixel'))) {
    out.push({ key: 'holdPaid', text: L(lo, 'Hold paid planning until budget, conversion destination, and tracking are clear.', 'أجِّل تخطيط المدفوع حتى تتضح الميزانية ووجهة التحويل والتتبع.') })
  }
  // 3. KPIs are hypotheses.
  if (input.kpisAreHypotheses) {
    out.push({ key: 'kpiHypo', text: L(lo, 'Treat KPIs as hypotheses until real performance data exists.', 'تعامل مع مؤشرات الأداء كفرضيات حتى تتوفر بيانات أداء حقيقية.') })
  }
  // 4. Anchor on the strongest segment.
  const seg = clause(input.topSegment, 50)
  if (seg) {
    out.push({ key: 'segment', text: L(lo, `Anchor messaging around your strongest segment: ${seg}.`, `ركّز الرسائل حول أقوى شريحة لديك: ${seg}.`) })
  }
  // 5. Sharpen via Brand Brain (only if not already implied by holdPaid).
  if (keys.length > 0 && !out.some(d => d.key === 'holdPaid')) {
    out.push({ key: 'brand', text: L(lo, 'Sharpen the strategy by completing your Brand Brain data.', 'اجعل الاستراتيجية أدق بإكمال بيانات Brand Brain.') })
  }

  return out.slice(0, 3)
}

interface Props extends VerdictInput {}

export default function StrategicVerdictCard(props: Props) {
  const lo = props.locale
  const { text } = deriveStrategicVerdict(props)
  const decisions = deriveTopDecisions(props)

  return (
    <div className="rounded-2xl p-5 space-y-3"
      style={{ background: 'rgba(10,11,28,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">
          {L(lo, 'Strategic direction', 'الاتجاه الاستراتيجي')}
        </span>
        <p className="text-white text-[15px] font-medium leading-snug">{text}</p>
      </div>
      {decisions.length > 0 && (
        <ol className="space-y-1.5 pt-0.5">
          {decisions.map((d, i) => (
            <li key={d.key} className="flex items-start gap-2.5 text-[13px] text-gray-300 leading-relaxed">
              <span className="flex-shrink-0 text-[11px] font-semibold text-gray-500 mt-0.5">{i + 1}</span>
              <span>{d.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
