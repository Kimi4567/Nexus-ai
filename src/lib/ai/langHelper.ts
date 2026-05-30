/**
 * NEXUS AI — Language Instruction Helper
 *
 * Converts a user/workspace language preference into a structured AI prompt
 * instruction. Injected into every AI system prompt so output matches the
 * user's chosen language.
 *
 * Supported values:
 *   'ar'        → Arabic output (MSA / الفصحى) — default
 *   'en'        → English output
 *   'bilingual' → Both Arabic and English, clearly separated
 */

export type LangPref = 'ar' | 'en' | 'bilingual'

/**
 * Returns a language instruction string ready to embed in an AI system prompt.
 * Defaults to Arabic for backwards compatibility with existing Arabic users.
 */
export function getLanguageInstruction(lang?: string): string {
  switch (lang) {
    case 'en':
      return `LANGUAGE REQUIREMENT: Respond entirely in English. Use clear, professional English suitable for UAE/GCC business users. All text content — hooks, scripts, captions, CTAs, strategy summaries, content ideas, value propositions — must be written in English. Only JSON keys stay in their original form.`

    case 'bilingual':
      return `LANGUAGE REQUIREMENT: Respond bilingually. Provide both Arabic and English for all user-facing text content (hooks, scripts, captions, CTAs, strategy summaries, content ideas). Format bilingual fields as: Arabic text followed by " | " then the English version. Example: "اكتشف الفرق الحقيقي | Discover the real difference". JSON keys stay in English.`

    case 'ar':
    default:
      return `LANGUAGE REQUIREMENT: Respond in Arabic. Use clear, professional Modern Standard Arabic (MSA / الفصحى) suitable for UAE/GCC business users. Write naturally for Arabic-speaking audiences in Saudi Arabia, UAE, and the broader Arab world. All text content MUST be in Arabic — hooks, scripts, captions, CTAs, strategy text, content ideas. Only JSON keys, platform names, and format types (Video/Carousel/etc) stay in English.`
  }
}
