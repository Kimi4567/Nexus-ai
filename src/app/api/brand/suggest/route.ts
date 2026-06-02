import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'

/* ═══════════════════════════════════════════════════════════════
   POST /api/brand/suggest
   Takes partial brand data + field to suggest
   Returns AI-generated suggestions for that field
   ═══════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { field, brandName, industry, description, primaryOffer, targetAudience, locale } = body

    if (!field) return NextResponse.json({ error: 'field required' }, { status: 400 })

    const isAr = locale === 'ar'
    const lang = isAr ? 'Arabic' : 'English'

    const context = [
      brandName && `Brand: ${brandName}`,
      industry  && `Industry: ${industry}`,
      description && `Description: ${description}`,
      primaryOffer && `Main offer: ${primaryOffer}`,
      targetAudience && `Target audience: ${targetAudience}`,
    ].filter(Boolean).join('\n')

    // ── Text fields (return { suggestion: string }) ───────────────
    const textFieldPrompts: Record<string, string> = {
      description:    `Based on this brand context, write a compelling 2-3 sentence brand description. Return ONLY the description text in ${lang}. No intro, no explanation.`,
      primaryOffer:   `Based on this brand context, write a clear and specific 1-2 sentence description of the main product or service. Return ONLY the description in ${lang}. No intro, no explanation.`,
      targetAudience: `Based on this brand context, write a specific target audience description covering demographics, interests, and pain points. 2-3 sentences. Return ONLY the audience description in ${lang}. No intro, no explanation.`,
      writingStyle:   `Based on this brand context, suggest a specific writing style approach for their marketing copy. 1-2 sentences. Return ONLY the style description in ${lang}. No intro, no explanation.`,
      competitorNotes:`Based on this brand context, write 2-3 sentences about the competitive landscape this brand likely operates in and key differentiators to emphasize. Return ONLY the notes in ${lang}. No intro, no explanation.`,
    }

    // ── Array fields (return { suggestions: string[] }) ───────────
    const arrayFieldPrompts: Record<string, string> = {
      audiencePainPoints: `Based on this brand context, suggest 4-6 specific pain points that the target audience experiences. Return ONLY a JSON array of short phrases (3-8 words each) in ${lang}. No explanation, just the array.`,
      audienceDesires:    `Based on this brand context, suggest 4-6 specific desires and aspirations the target audience has. Return ONLY a JSON array of short phrases (3-8 words each) in ${lang}. No explanation, just the array.`,
      toneKeywords:       `Based on this brand context, suggest 4-6 tone of voice keywords that fit this brand. Return ONLY a JSON array of single adjective words in ${lang}. No explanation, just the array.`,
      uniqueAdvantages:   `Based on this brand context, suggest 4-6 unique competitive advantages this brand likely has. Return ONLY a JSON array of short phrases (3-8 words each) in ${lang}. No explanation, just the array.`,
      winningHooks:       `Based on this brand context, suggest 3-4 compelling marketing hooks/headlines for this brand. Return ONLY a JSON array of hooks in ${lang}. No explanation, just the array.`,
      secondaryOffers:    `Based on this brand context, suggest 3-5 secondary products or services this brand might realistically offer. Return ONLY a JSON array of short phrases in ${lang}. No explanation, just the array.`,
      winningAngles:      `Based on this brand context, suggest 3-5 proven marketing angles and creative approaches for campaigns. Return ONLY a JSON array of short descriptive phrases in ${lang}. No explanation, just the array.`,
      avoidKeywords:      `Based on this brand context, suggest 4-6 words, phrases, or tones this brand should AVOID in their copy to protect their positioning. Return ONLY a JSON array in ${lang}. No explanation, just the array.`,
    }

    if (textFieldPrompts[field]) {
      const prompt = textFieldPrompts[field]
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `You are a marketing strategist. Return ONLY the requested text with no explanation or preamble. Context:\n${context}` },
            { role: 'user', content: prompt },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      })
      const completion = await res.json()
      const suggestion: string = completion.choices?.[0]?.message?.content?.trim() || ''
      return NextResponse.json({ suggestion })
    }

    const prompt = arrayFieldPrompts[field]
    if (!prompt) return NextResponse.json({ error: 'Unknown field' }, { status: 400 })

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are a marketing strategist. Always respond with valid JSON arrays only. Context:\n${context}` },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    })
    const completion = await res.json()

    const raw: string = completion.choices?.[0]?.message?.content?.trim() || '[]'
    // Strip markdown code block if present
    const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
    let suggestions: string[] = []
    try {
      suggestions = JSON.parse(cleaned)
      if (!Array.isArray(suggestions)) suggestions = []
    } catch {
      suggestions = []
    }

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('POST /api/brand/suggest error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
