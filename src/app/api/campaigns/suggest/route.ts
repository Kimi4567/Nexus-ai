import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

/* ═══════════════════════════════════════════════════════════════
   POST /api/campaigns/suggest
   Generates AI text suggestions for campaign wizard fields.
   Uses brand brain context + current form data for relevance.

   Fields:
     name        → catchy campaign name
     description → product/service description
     audience    → target audience description
   ═══════════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { field, name, description, goal, locale } = body

    if (!field) return NextResponse.json({ error: 'field required' }, { status: 400 })

    const isAr = locale === 'ar'
    const lang = isAr ? 'Arabic' : 'English'

    // ── Load Brand Brain for context ──────────────────────────────
    let brandContext = ''
    try {
      const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
      if (workspace) {
        const brand = await prisma.brandProfile.findUnique({ where: { workspaceId: workspace.id } })
        if (brand) {
          const parts = [
            brand.brandName   && `Brand: ${brand.brandName}`,
            brand.industry    && `Industry: ${brand.industry}`,
            brand.description && `Brand desc: ${brand.description}`,
            brand.primaryOffer && `Main offer: ${brand.primaryOffer}`,
            brand.targetAudience && `Target audience: ${brand.targetAudience}`,
            brand.uniqueAdvantages?.length && `Advantages: ${(brand.uniqueAdvantages as string[]).join(', ')}`,
            brand.toneKeywords?.length && `Tone: ${(brand.toneKeywords as string[]).join(', ')}`,
          ].filter(Boolean)
          brandContext = parts.join('\n')
        }
      }
    } catch { /* non-fatal */ }

    const campaignContext = [
      name        && `Campaign name: ${name}`,
      description && `Product/Service: ${description}`,
      goal        && `Campaign goal: ${goal}`,
    ].filter(Boolean).join('\n')

    const fullContext = [brandContext, campaignContext].filter(Boolean).join('\n---\n')

    // ── Field-specific prompts ─────────────────────────────────────
    const prompts: Record<string, string> = {
      name: `Based on this context, suggest a short compelling campaign name (4-8 words max). Return ONLY the campaign name as plain text, no quotes, no explanation. Language: ${lang}.

Context:
${fullContext || 'No context provided'}`,

      description: `Based on this context, write a clear and compelling 1-2 sentence description of the product or service being advertised. Return ONLY the description text, no intro, no explanation. Language: ${lang}.

Context:
${fullContext || 'No context provided'}`,

      audience: `Based on this context, write a specific target audience description (demographics, interests, pain points). 2-3 sentences max. Return ONLY the audience description, no intro, no explanation. Language: ${lang}.

Context:
${fullContext || 'No context provided'}`,
    }

    const prompt = prompts[field]
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
          {
            role: 'system',
            content: 'You are a marketing copywriter. Return ONLY the requested text with no explanation or preamble.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.75,
      }),
    })

    const completion = await res.json()
    const suggestion: string = completion.choices?.[0]?.message?.content?.trim() || ''

    return NextResponse.json({ suggestion })
  } catch (error) {
    console.error('POST /api/campaigns/suggest error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
