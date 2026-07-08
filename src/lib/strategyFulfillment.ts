import {
  deriveContentPlanOrderReview,
  type ContentPlanOrderPostLike,
} from './contentPlanOrderContract'

export type StrategyFulfillmentStatus =
  | 'checking'
  | 'matched'
  | 'waiting_for_content_hub'
  | 'paid_planning_only'
  | 'mismatch'
  | 'missing_scope'
  | 'legacy'

export type StrategyFulfillmentTone = 'positive' | 'warning' | 'danger' | 'muted' | 'checking'

export interface StrategyFulfillmentSummary {
  status: StrategyFulfillmentStatus
  tone: StrategyFulfillmentTone
  label: string
  value: string
  helper: string
  expectedDirections: number | null
  actualDirections: number
  strategyType: string | null
  planningHorizonDays: number | null
}

interface StrategyFulfillmentInput {
  aiOutput: unknown
  posts: ContentPlanOrderPostLike[]
  operatingSnapshotsLoaded: boolean
  locale?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOrNull(value: unknown): number | null {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function text(ar: boolean, arText: string, enText: string): string {
  return ar ? arText : enText
}

function strategyTypeLabel(strategyType: string | null, ar: boolean): string {
  if (strategyType === 'paid') return text(ar, 'مدفوع فقط', 'paid-only')
  if (strategyType === 'full') return text(ar, 'شامل', 'full')
  if (strategyType === 'organic') return text(ar, 'عضوي فقط', 'organic-only')
  return text(ar, 'غير محدد', 'unspecified')
}

function countLabel(count: number, ar: boolean): string {
  if (ar) return `${count} منشور`
  return `${count} post${count === 1 ? '' : 's'}`
}

function orderContext(aiOutput: unknown, strategyType: string | null): {
  planningHorizonDays: number | null
  helperSuffix: (ar: boolean) => string
} {
  const output = isRecord(aiOutput) ? aiOutput : null
  const order = output && isRecord(output.strategyOrder) ? output.strategyOrder : null
  const deliverables = output && isRecord(output.strategyDeliverables) ? output.strategyDeliverables : null

  const planningHorizonDays = numberOrNull(deliverables?.planningHorizonDays) ?? numberOrNull(order?.durationDays)

  return {
    planningHorizonDays,
    helperSuffix: (ar: boolean) => {
      const scope = strategyTypeLabel(strategyType, ar)
      if (planningHorizonDays !== null) {
        return text(
          ar,
          `الأمر المحفوظ: ${scope} لمدة ${planningHorizonDays} يوم.`,
          `Saved order: ${scope}, ${planningHorizonDays}-day planning horizon.`,
        )
      }
      return text(ar, `الأمر المحفوظ: ${scope}.`, `Saved order: ${scope}.`)
    },
  }
}

export function deriveStrategyFulfillmentSummary(input: StrategyFulfillmentInput): StrategyFulfillmentSummary {
  const ar = input.locale === 'ar'
  const review = deriveContentPlanOrderReview(input.aiOutput, input.posts)
  const { planningHorizonDays, helperSuffix } = orderContext(input.aiOutput, review.strategyType)
  const label = text(ar, 'مطابقة وعد التوليد', 'Order fulfillment')

  if (!input.operatingSnapshotsLoaded) {
    return {
      status: 'checking',
      tone: 'checking',
      label,
      value: text(ar, 'قيد فحص منشورات Content Hub', 'Checking Content Hub posts'),
      helper: text(
        ar,
        'لا نحكم على المطابقة قبل تحميل سجلات المنشورات الفعلية.',
        'NEXUS does not judge fulfillment until real post records load.',
      ),
      expectedDirections: review.expectedDirections,
      actualDirections: review.actualDirections,
      strategyType: review.strategyType,
      planningHorizonDays,
    }
  }

  if (!review.bound) {
    return {
      status: 'legacy',
      tone: 'muted',
      label,
      value: text(ar, 'حملة قديمة بدون أمر محفوظ', 'Legacy campaign without saved order'),
      helper: text(
        ar,
        'لا توجد بيانات أمر توليد موثوقة للمقارنة. راجع Content Hub كحقيقة المنشورات.',
        'No reliable saved generation order is available to compare. Use Content Hub as post truth.',
      ),
      expectedDirections: null,
      actualDirections: review.actualDirections,
      strategyType: null,
      planningHorizonDays: null,
    }
  }

  if (review.reason === 'missing-organic-count') {
    return {
      status: 'missing_scope',
      tone: 'danger',
      label,
      value: text(ar, 'نطاق المنشورات غير محفوظ بوضوح', 'Post-count scope is missing'),
      helper: text(
        ar,
        'يوجد أمر استراتيجية محفوظ، لكن عدد منشورات Content Hub المتوقع غير موثوق. أصلح العقد قبل الاعتماد.',
        'A strategy order exists, but the expected Content Hub post count is not reliable. Repair the contract before approval.',
      ),
      expectedDirections: null,
      actualDirections: review.actualDirections,
      strategyType: review.strategyType,
      planningHorizonDays,
    }
  }

  if (review.expectedDirections === 0 && review.ok) {
    return {
      status: 'paid_planning_only',
      tone: 'positive',
      label,
      value: text(ar, 'مطابق: لا منشورات عضوية مطلوبة', 'Matched: no organic posts expected'),
      helper: `${helperSuffix(ar)} ${text(
        ar,
        'هذه خطة مدفوعة للمراجعة فقط؛ لا يجب أن تنشئ Content Hub منشورات عضوية.',
        'This is paid planning for review only; Content Hub should not create organic posts.',
      )}`,
      expectedDirections: 0,
      actualDirections: review.actualDirections,
      strategyType: review.strategyType,
      planningHorizonDays,
    }
  }

  if (review.expectedDirections !== null && review.actualDirections === 0 && review.expectedDirections > 0) {
    return {
      status: 'waiting_for_content_hub',
      tone: 'warning',
      label,
      value: text(
        ar,
        `الوعد محفوظ: ${countLabel(review.expectedDirections, ar)} لم تُنشأ بعد`,
        `Order saved: ${countLabel(review.expectedDirections, ar)} not created yet`,
      ),
      helper: `${helperSuffix(ar)} ${text(
        ar,
        'توليد الاستراتيجية لا يحفظ منشورات نهائية؛ يتم إنشاء المسودات لاحقاً في Content Hub.',
        'Strategy generation does not save final posts; draft posts are created later in Content Hub.',
      )}`,
      expectedDirections: review.expectedDirections,
      actualDirections: review.actualDirections,
      strategyType: review.strategyType,
      planningHorizonDays,
    }
  }

  if (review.ok && review.expectedDirections !== null) {
    return {
      status: 'matched',
      tone: 'positive',
      label,
      value: text(
        ar,
        `مطابق: ${review.actualDirections} من ${review.expectedDirections} منشورات`,
        `Matched: ${review.actualDirections} / ${review.expectedDirections} posts`,
      ),
      helper: `${helperSuffix(ar)} ${text(
        ar,
        'عدد منشورات Content Hub الحالية يطابق الوعد المحفوظ قبل التوليد.',
        'Current Content Hub post count matches the saved pre-generation order.',
      )}`,
      expectedDirections: review.expectedDirections,
      actualDirections: review.actualDirections,
      strategyType: review.strategyType,
      planningHorizonDays,
    }
  }

  return {
    status: 'mismatch',
    tone: 'danger',
    label,
    value: text(
      ar,
      `عدم تطابق: الموجود ${review.actualDirections} والمتوقع ${review.expectedDirections ?? '؟'}`,
      `Mismatch: ${review.actualDirections} actual, ${review.expectedDirections ?? '?'} expected`,
    ),
    helper: text(
      ar,
      'لا تعتمد أو تجدول قبل إصلاح الفرق بين وعد التوليد ومنشورات Content Hub الحالية.',
      'Do not approve or schedule before repairing the gap between the saved order and current Content Hub posts.',
    ),
    expectedDirections: review.expectedDirections,
    actualDirections: review.actualDirections,
    strategyType: review.strategyType,
    planningHorizonDays,
  }
}
