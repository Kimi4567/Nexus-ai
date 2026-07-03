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
 *   'bilingual' → Smart mix: AI decides per-post based on platform & audience
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
      return `LANGUAGE REQUIREMENT: Smart bilingual strategy — assign the most effective language to each piece of content individually, based on the brand's audience and each platform's primary user base.

DECISION RULES (apply per post/platform):
- LinkedIn → English (professional/B2B audience)
- Instagram, TikTok, Snapchat targeting GCC consumers → Arabic
- Facebook → match the brand's dominant market language
- International/expat-focused content → English
- GCC consumer-facing content (Saudi, UAE, Kuwait, etc.) → Arabic
- Young GCC professionals (18-35) → Arabic preferred
- For multi-post content plans, the final set MUST include both Arabic and English posts where there are at least 4 posts. Aim for a practical mix, with at least 30% Arabic and at least 30% English unless the user explicitly requested only one language.

Each post, caption, hook, and CTA must be written ENTIRELY in ONE language — either Arabic OR English — never a hybrid "Arabic | English" mix in the same sentence. The language per item is dictated by who will actually see and engage with that specific content. Document your language allocation rationale in the strategy section. JSON keys always stay in English.`

    case 'ar':
    default:
      return `LANGUAGE REQUIREMENT: Respond in Arabic. Use clear, professional Modern Standard Arabic (MSA / الفصحى) suitable for UAE/GCC business users. Write naturally for Arabic-speaking audiences in Saudi Arabia, UAE, and the broader Arab world. All text content MUST be in Arabic — hooks, scripts, captions, CTAs, strategy text, content ideas, and user-facing format labels. English source notes or schema descriptions are instructions only; translate or adapt user-facing values into Arabic instead of copying the source language. JSON keys and platform names may stay in English.`
  }
}
