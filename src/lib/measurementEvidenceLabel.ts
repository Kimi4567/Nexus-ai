export type MeasurementEvidenceLocale = 'ar' | 'en'

const EVIDENCE_LABELS: Record<string, Record<MeasurementEvidenceLocale, string>> = {
  CLIENT_REPORTED: {
    ar: 'إشارة من المتصفح',
    en: 'Browser-reported',
  },
  SERVER_CONFIRMED: {
    ar: 'مؤكد من الخادم',
    en: 'Server-confirmed',
  },
  SERVER_DEDUPLICATED: {
    ar: 'منقّح من التكرار',
    en: 'Server-deduplicated',
  },
  MANUAL_CONFIRMED: {
    ar: 'مؤكد داخل CRM',
    en: 'CRM-confirmed',
  },
}

/**
 * Converts internal evidence-state identifiers into user-facing trust labels.
 * Unknown values pass through because some metric helpers are percentages or
 * intentionally localized explanatory messages rather than state keys.
 */
export function measurementEvidenceLabel(
  value: string,
  locale: MeasurementEvidenceLocale,
): string {
  return EVIDENCE_LABELS[value]?.[locale] ?? value
}
