/**
 * PR-S1a — Deliverables Contract (pure, deterministic).
 *
 * getStrategyDeliverables(order, planContext?) turns a confirmed StrategyOrder
 * into a deterministic set of deliverables + generation instructions. ALL counts
 * come from here — never from the AI. No I/O, no credits, no generation, no
 * persistence. This is the single source of truth for "what will be generated"
 * shown before any charge (UI wiring is a later PR).
 *
 * Core rules enforced here:
 *  - Duration is a PLANNING HORIZON. Strategy runs produce a roadmap and an
 *    execution outline for the first ≤30 days. Final Content Hub draft posts,
 *    captions, SocialPost rows, and saved calendars are generated separately.
 *  - Content intensity sets the organic post target; the plan quota CAPS it.
 *  - Paid is planning-only (never launch/spend/publish/activation/fake metrics).
 *  - Full aligns organic + paid (shared angles/funnel/retargeting) without
 *    blindly doubling output.
 *  - Custom > 180 days is unsupported (custom quote) — caller must block charge.
 */

import type {
  StrategyOrder,
  StrategyDeliverables,
  PlanContextLike,
  ContentIntensity,
  StrategyLanguage,
} from './strategyOrder'
import {
  customOrganicPostCountUnsupported,
  isValidCustomOrganicPostCount,
  MAX_CUSTOM_ORGANIC_POST_COUNT,
} from './strategyPostCount'

export const MAX_SUPPORTED_DAYS = 180
export const MAX_DETAILED_CALENDAR_DAYS = 30

/** Intensity → representative monthly organic post target (top of each band). */
export const INTENSITY_POST_TARGET: Record<ContentIntensity, number> = {
  light: 10,    // 8–10
  standard: 16, // 12–16
  growth: 25,   // 20–25
  daily: 30,    // 30
}

/** Intensity → human band label (for explanations). */
const INTENSITY_BAND: Record<ContentIntensity, string> = {
  light: '8–10',
  standard: '12–16',
  growth: '20–25',
  daily: '30',
}

// Paid deliverable counts — representative values inside the product's bands.
const PAID_AD_ANGLE_COUNT = 4        // 3–5
const PAID_AD_COPY_VARIATIONS = 9    // 6–12
const PAID_CREATIVE_BRIEFS = 4       // 3–5
const PAID_AUDIENCE_HYPOTHESES = 3   // 2–3

const DEFAULT_PLATFORM_VARIANTS = 3

/** Resolve the effective horizon in days from preset/custom inputs. */
function resolveHorizonDays(order: StrategyOrder): number {
  if (order.durationPreset === '30') return 30
  if (order.durationPreset === '90') return 90
  if (order.durationPreset === '180') return 180
  // custom — clamp to a sane positive integer
  const d = Math.floor(order.durationDays)
  return Number.isFinite(d) && d > 0 ? d : 0
}

/** Horizon (days) → roadmap length in months, per the duration buckets. */
function roadmapMonthsFor(days: number): number {
  if (days <= 30) return 1
  if (days <= 60) return 2
  if (days <= 90) return 3
  return 6 // 91–180
}

function joinLines(lines: Array<string | false | null | undefined>): string {
  return lines.filter((l): l is string => typeof l === 'string' && l.length > 0).join(' ')
}

/**
 * UI-facing localization for deterministic internal deliverable labels.
 * The contract itself stays English/stable for tests and prompt wiring; runtime
 * surfaces should translate it before showing Arabic users the cost review.
 */
export function formatStrategyDeliverableForLocale(item: string, locale: 'ar' | 'en' = 'en'): string {
  if (locale !== 'ar') return item

  const translateSuffix = (suffix = ''): string => {
    const trimmed = suffix.trim()
    if (!trimmed) return ''
    if (trimmed === 'for the first 30 days') return 'لأول 30 يوم'
    return trimmed
  }

  const exactAfterCap = item.match(/^Exact organic post directions after plan cap \((\d+); requested (\d+)\)(.*)$/)
  if (exactAfterCap) {
    const suffix = translateSuffix(exactAfterCap[3])
    return `اتجاهات منشورات عضوية محددة بعد حد الخطة (${exactAfterCap[1]}؛ المطلوب ${exactAfterCap[2]})${suffix ? ' ' + suffix : ''}`.trim()
  }

  const exactRequested = item.match(/^Exact organic post directions requested \((\d+)\)(.*)$/)
  if (exactRequested) {
    const suffix = translateSuffix(exactRequested[2])
    return `اتجاهات منشورات عضوية محددة (${exactRequested[1]})${suffix ? ' ' + suffix : ''}`.trim()
  }

  const organicTarget = item.match(/^Organic post direction target \((\d+)\)(.*)$/)
  if (organicTarget) {
    const suffix = translateSuffix(organicTarget[2])
    return `هدف اتجاهات المنشورات العضوية (${organicTarget[1]})${suffix ? ' ' + suffix : ''}`.trim()
  }

  const monthRoadmap = item.match(/^(\d+)-month organic roadmap$/)
  if (monthRoadmap) return `خريطة طريق عضوية لمدة ${monthRoadmap[1]} أشهر`

  const platformAdaptations = item.match(/^Platform adaptations \((\d+) active platforms\)$/)
  if (platformAdaptations) return `تكييفات للمنصات (${platformAdaptations[1]} منصات نشطة)`

  const adCopyVariations = item.match(/^Ad copy variations \((\d+)\)$/)
  if (adCopyVariations) return `نسخ إعلانية للمراجعة (${adCopyVariations[1]})`

  const creativeBriefs = item.match(/^Creative briefs \((\d+)\)$/)
  if (creativeBriefs) return `بريفات إبداعية للمراجعة (${creativeBriefs[1]})`

  const audienceHypotheses = item.match(/^Audience hypotheses \((\d+)\)$/)
  if (audienceHypotheses) return `فرضيات جمهور للمراجعة (${audienceHypotheses[1]})`

  const translations: Record<string, string> = {
    'First 30-day strategy execution outline': 'مخطط تنفيذ استراتيجي لأول 30 يوم',
    'Weekly themes and execution priorities for the first 30 days': 'محاور أسبوعية وأولويات تنفيذ لأول 30 يوم',
    'Months 2+ as themes / backlog / future monthly cycles (not pre-generated posts)': 'الأشهر التالية كمحاور وقائمة أفكار ودورات شهرية مستقبلية، وليست منشورات مولدة مسبقاً',
    'Content Hub draft posts generated separately after strategy review': 'مسودات Content Hub تُولَّد لاحقاً بعد مراجعة الاستراتيجية',
    'Weekly extension outline beyond the detailed 30 days': 'مخطط أسبوعي امتدادي بعد أول 30 يوم المفصلة',
    'Detailed 30-day strategy': 'استراتيجية مفصلة لمدة 30 يوم',
    'First-month strategy execution outline': 'مخطط تنفيذ للشهر الأول',
    'Weekly themes and execution priorities': 'محاور أسبوعية وأولويات تنفيذ',
    'Captions / CTA direction': 'اتجاه التعليقات ودعوات الإجراء',
    'Platform recommendations': 'توصيات المنصات',
    'Pre-generated posts for every day of the full horizon': 'منشورات مولدة مسبقاً لكل يوم في كامل المدة',
    'Saved Content Hub content plan': 'خطة محتوى محفوظة داخل Content Hub',
    'Final SocialPost drafts / captions': 'مسودات SocialPost أو تعليقات نهائية',
    'Scheduled calendar entries': 'عناصر تقويم مجدولة',
    'Campaign objective': 'هدف الحملة للمراجعة',
    'Funnel structure': 'هيكل القمع التسويقي',
    'Ad angles (4)': 'زوايا إعلانية للمراجعة (4)',
    'Budget split': 'تقسيم ميزانية كمراجعة تخطيطية',
    'Tracking checklist': 'قائمة تحقق للتتبع',
    'Launch blockers': 'عوائق الإطلاق',
    'Planning-only warning': 'تنبيه أن المدفوع تخطيط فقط',
    'Ad launch': 'إطلاق الإعلانات',
    'Ad spend': 'صرف ميزانية إعلانية',
    'Publishing': 'النشر',
    'Campaign execution': 'تنفيذ الحملة',
    'Performance projections / invented metrics': 'توقعات أداء أو أرقام غير مثبتة',
    'Shared message angles across organic + paid': 'زوايا رسائل مشتركة بين العضوي والمدفوع',
    'Funnel alignment (organic ↔ paid)': 'مواءمة القمع بين العضوي والمدفوع',
    'Retargeting direction': 'اتجاه إعادة الاستهداف كمراجعة مستقبلية',
    'Creative angle alignment': 'مواءمة الزوايا الإبداعية',
    'Paid campaign plan': 'خطة حملة مدفوعة',
    'Organic content plan': 'خطة محتوى عضوي',
    'Organic Content Hub content plan': 'خطة Content Hub عضوية',
  }

  return translations[item] ?? item
}

/**
 * Build the contract. Pure: same inputs → same output, no side effects.
 */
export function getStrategyDeliverables(
  order: StrategyOrder,
  planContext?: PlanContextLike,
): StrategyDeliverables {
  const horizon = resolveHorizonDays(order)
  const ar = order.language === 'ar'
  const both = order.language === 'both'

  // ── Unsupported: custom > 180 days (or non-positive) → block before charging ──
  if (horizon > MAX_SUPPORTED_DAYS || horizon <= 0 || customOrganicPostCountUnsupported(order)) {
    const customCountInvalid = customOrganicPostCountUnsupported(order)
    const reason =
      customCountInvalid
        ? `Custom organic post count must be between 1 and ${MAX_CUSTOM_ORGANIC_POST_COUNT}.`
        : horizon > MAX_SUPPORTED_DAYS
        ? `Planning horizons over ${MAX_SUPPORTED_DAYS} days are not supported yet — request a custom quote / contact support.`
        : 'A valid positive planning horizon is required.'
    const explEn = customCountInvalid
      ? `Custom organic post count must be between 1 and ${MAX_CUSTOM_ORGANIC_POST_COUNT}. Nothing has been generated or charged.`
      : horizon > MAX_SUPPORTED_DAYS
      ? `Strategies longer than ${MAX_SUPPORTED_DAYS} days aren’t supported yet. Please contact support for a custom quote — nothing has been generated or charged.`
      : 'Please choose a valid duration — nothing has been generated or charged.'
    const explAr = customCountInvalid
      ? `يجب أن يكون عدد اتجاهات المنشورات العضوية المخصص بين 1 و${MAX_CUSTOM_ORGANIC_POST_COUNT}. لم يتم توليد أو خصم أي شيء.`
      : horizon > MAX_SUPPORTED_DAYS
      ? `الخطط الأطول من ${MAX_SUPPORTED_DAYS} يوماً غير مدعومة بعد. تواصل مع الدعم للحصول على عرض سعر مخصّص — لم يتم توليد أو خصم أي شيء.`
      : 'يرجى اختيار مدة صحيحة — لم يتم توليد أو خصم أي شيء.'
    return {
      supported: false,
      unsupportedReason: reason,
      planningHorizonDays: horizon,
      detailedCalendarDays: 0,
      roadmapMonths: 0,
      organicPostCount: 0,
      requestedOrganicPostCount: 0,
      planCappedOrganicPostCount: planContext?.postsPerMonth ?? null,
      planCapApplied: false,
      platformVariantCount: 0,
      paidAdVariationCount: 0,
      creativeBriefCount: 0,
      audienceHypothesisCount: 0,
      includedDeliverables: [],
      excludedDeliverables: [],
      userExplanation: both ? `${explEn} ${explAr}` : ar ? explAr : explEn,
      generationInstructions: customCountInvalid
        ? 'DO NOT GENERATE. Unsupported custom organic post count.'
        : 'DO NOT GENERATE. Unsupported planning horizon — requires a custom quote.',
    }
  }

  const detailedCalendarDays = Math.min(MAX_DETAILED_CALENDAR_DAYS, horizon)
  const roadmapMonths = roadmapMonthsFor(horizon)
  const isMultiMonth = horizon > 30
  const hasExtension = horizon > 30 && horizon <= 60 // 31–60 → first 30 detailed + weekly extension

  const includesOrganic = order.strategyType === 'organic' || order.strategyType === 'full'
  const includesPaid = order.strategyType === 'paid' || order.strategyType === 'full'

  // ── Organic post count (intensity → request → plan cap) ──
  const customOrganicPostCount = includesOrganic && isValidCustomOrganicPostCount(order.customOrganicPostCount)
    ? order.customOrganicPostCount
    : null
  const requestedOrganicPostCount = includesOrganic
    ? (customOrganicPostCount ?? INTENSITY_POST_TARGET[order.contentIntensity])
    : 0
  const quota = typeof planContext?.postsPerMonth === 'number' ? planContext.postsPerMonth : null
  const planCappedOrganicPostCount = quota
  const planCapApplied = includesOrganic && quota !== null && requestedOrganicPostCount > quota
  const organicPostCount = includesOrganic
    ? (quota !== null ? Math.min(requestedOrganicPostCount, quota) : requestedOrganicPostCount)
    : 0

  const platformVariantCount = includesOrganic
    ? (typeof planContext?.platformCount === 'number' && planContext.platformCount > 0
        ? planContext.platformCount
        : DEFAULT_PLATFORM_VARIANTS)
    : 0

  const paidAdVariationCount = includesPaid ? PAID_AD_COPY_VARIATIONS : 0
  const creativeBriefCount = includesPaid ? PAID_CREATIVE_BRIEFS : 0
  const audienceHypothesisCount = includesPaid ? PAID_AUDIENCE_HYPOTHESES : 0

  // ── Included / excluded deliverables ──
  const included: string[] = []
  const excluded: string[] = []

  if (includesOrganic) {
    const countLabel = customOrganicPostCount
      ? planCapApplied
        ? `Exact organic post directions after plan cap (${organicPostCount}; requested ${customOrganicPostCount})`
        : `Exact organic post directions requested (${organicPostCount})`
      : `Organic post direction target (${organicPostCount})`
    if (isMultiMonth) {
      included.push(`${roadmapMonths}-month organic roadmap`)
      included.push('First 30-day strategy execution outline')
      included.push(`${countLabel} for the first 30 days`)
      included.push('Weekly themes and execution priorities for the first 30 days')
      included.push('Months 2+ as themes / backlog / future monthly cycles (not pre-generated posts)')
      included.push('Content Hub draft posts generated separately after strategy review')
      if (hasExtension) included.push('Weekly extension outline beyond the detailed 30 days')
    } else {
      included.push(`Detailed ${detailedCalendarDays}-day strategy`)
      included.push('First-month strategy execution outline')
      included.push(countLabel)
      included.push('Weekly themes and execution priorities')
      included.push('Content Hub draft posts generated separately after strategy review')
    }
    included.push('Captions / CTA direction')
    included.push('Platform recommendations')
    excluded.push('Pre-generated posts for every day of the full horizon')
    excluded.push('Saved Content Hub content plan')
    excluded.push('Final SocialPost drafts / captions')
    excluded.push('Scheduled calendar entries')
  }

  if (includesPaid) {
    included.push('Campaign objective')
    included.push('Funnel structure')
    included.push(`Audience hypotheses (${audienceHypothesisCount})`)
    included.push(`Ad angles (${PAID_AD_ANGLE_COUNT})`)
    included.push(`Ad copy variations (${paidAdVariationCount})`)
    included.push(`Creative briefs (${creativeBriefCount})`)
    included.push('Budget split')
    included.push('Tracking checklist')
    included.push('Launch blockers')
    included.push('Planning-only warning')
    // Paid is planning-only — these are always excluded.
    excluded.push('Ad launch')
    excluded.push('Ad spend')
    excluded.push('Publishing')
    excluded.push('Campaign execution')
    excluded.push('Performance projections / invented metrics')
  }

  if (order.strategyType === 'full') {
    included.push('Shared message angles across organic + paid')
    included.push('Funnel alignment (organic ↔ paid)')
    included.push('Retargeting direction')
    included.push('Creative angle alignment')
  }

  if (order.strategyType === 'organic') {
    excluded.push('Paid campaign plan')
  }
  if (order.strategyType === 'paid') {
    excluded.push('Organic Content Hub content plan')
  }

  // ── User explanation (localized) ──
  const horizonNote = isMultiMonth
    ? {
        en: `Your ${horizon}-day plan includes a full ${roadmapMonths}-month roadmap and a first-30-day execution outline. Content Hub draft posts and saved calendars are generated separately after strategy review.`,
        ar: `خطتك لمدة ${horizon} يوماً تشمل خريطة طريق كاملة لمدة ${roadmapMonths} أشهر، ومخطط تنفيذ لأول 30 يوماً. تُولَّد مسودات Content Hub والتقويمات المحفوظة لاحقاً بعد مراجعة الاستراتيجية.`,
      }
    : {
        en: `Your ${horizon}-day plan includes a detailed strategy and execution outline for the full ${detailedCalendarDays} days. Content Hub draft posts are generated separately after review.`,
        ar: `خطتك لمدة ${horizon} يوماً تشمل استراتيجية ومخطط تنفيذ لكامل الـ${detailedCalendarDays} يوماً. تُولَّد مسودات Content Hub لاحقاً بعد المراجعة.`,
      }

  const capNote = planCapApplied
    ? {
        en: ` You chose ${order.contentIntensity} intensity (${INTENSITY_BAND[order.contentIntensity]} posts/month), but your current plan allows ${quota} posts/month — so the first-30-day plan will use ${organicPostCount} post directions. Upgrade to unlock more.`,
        ar: ` اخترت كثافة ${order.contentIntensity} (${INTENSITY_BAND[order.contentIntensity]} منشوراً شهرياً)، لكن خطتك الحالية تسمح بـ${quota} منشوراً شهرياً — لذلك سيستخدم مخطط أول 30 يوماً ${organicPostCount} اتجاهات منشورات. قم بالترقية لفتح المزيد.`,
      }
    : { en: '', ar: '' }

  const customCountNote = customOrganicPostCount
    ? {
        en: ` You selected an exact first-30-day organic post-direction count: ${customOrganicPostCount}.`,
        ar: ` اخترت عدداً محدداً لاتجاهات المنشورات العضوية في أول 30 يوماً: ${customOrganicPostCount}.`,
      }
    : { en: '', ar: '' }

  const paidNote = includesPaid
    ? {
        en: ' Paid is planning-only — no ads are launched, no budget is spent, and nothing is published without your explicit approval.',
        ar: ' المدفوع تخطيط فقط — لا تُطلَق إعلانات، ولا تُصرَف ميزانية، ولا يُنشَر شيء دون موافقتك الصريحة.',
      }
    : { en: '', ar: '' }

  const explEn = joinLines([horizonNote.en, customCountNote.en, capNote.en, paidNote.en])
  const explAr = joinLines([horizonNote.ar, customCountNote.ar, capNote.ar, paidNote.ar])
  const userExplanation = both ? `${explEn} ${explAr}` : ar ? explAr : explEn

  // ── Generation instructions (single source of scope truth for the agents) ──
  const giParts: string[] = []
  giParts.push(`Strategy type: ${order.strategyType}. Planning horizon: ${horizon} days. Goal: ${order.goal || 'unspecified'}.`)
  if (isMultiMonth) {
    giParts.push(
      `Produce a ${roadmapMonths}-month roadmap and a FIRST-${detailedCalendarDays}-DAY STRATEGY EXECUTION OUTLINE using weeklyExecutionPlan/contentAnglesDetailed. This strategy run does NOT create saved Content Hub posts, final captions, SocialPost rows, scheduled calendar entries, or a persisted content plan. Months 2+ must be themes / backlog / future cycles — do NOT generate posts for every day of the full ${horizon}-day horizon.`,
    )
    if (hasExtension) giParts.push('Add a lightweight weekly extension outline for the days beyond the detailed 30, without per-day posts.')
  } else {
    giParts.push(`Generate a detailed strategy and execution outline for the full ${detailedCalendarDays} days. This strategy run does NOT create saved Content Hub posts, final captions, SocialPost rows, scheduled calendar entries, or a persisted content plan.`)
  }
  if (includesOrganic) {
    giParts.push(
      `Organic: produce exactly ${organicPostCount} post directions / angle ideas for the detailed window (this number is fixed by ${customOrganicPostCount ? "the order's exact custom post count" : 'the order'} — do NOT decide the count yourself). Return exactly ${organicPostCount} contentAnglesDetailed entries when organic scope is included. Distribute exactly ${organicPostCount} countable post directions across weeklyExecutionPlan.deliverables for the first ${detailedCalendarDays} days. These are planning directions, not final post drafts or scheduled Content Hub items.` +
        (planCapApplied ? ` (Requested intensity ${requestedOrganicPostCount} was capped by the plan quota ${quota}.)` : ''),
    )
  }
  if (includesPaid) {
    giParts.push(
      `Paid is PLANNING-ONLY: campaign objective, funnel, ${audienceHypothesisCount} audience hypotheses, ${PAID_AD_ANGLE_COUNT} ad angles, ${paidAdVariationCount} ad-copy variations, ${creativeBriefCount} creative briefs, budget split, tracking checklist, launch blockers. Never describe how to launch/activate ads, never spend budget, never publish, never invent performance numbers.`,
    )
  }
  if (order.strategyType === 'full') {
    giParts.push('Full strategy: ALIGN organic and paid (shared message angles, funnel alignment, retargeting direction, creative-angle alignment). Do NOT blindly double outputs — one aligned plan with shared assets.')
  }
  const generationInstructions = giParts.join(' ')

  return {
    supported: true,
    planningHorizonDays: horizon,
    detailedCalendarDays,
    roadmapMonths,
    organicPostCount,
    requestedOrganicPostCount,
    planCappedOrganicPostCount,
    planCapApplied,
    platformVariantCount,
    paidAdVariationCount,
    creativeBriefCount,
    audienceHypothesisCount,
    includedDeliverables: included,
    excludedDeliverables: excluded,
    userExplanation,
    generationInstructions,
  }
}
