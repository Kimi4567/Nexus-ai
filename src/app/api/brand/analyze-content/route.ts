/**
 * POST /api/brand/analyze-content
 *
 * Accepts up to 3 content samples (captions, posts, ads, scripts, emails).
 * GPT-4o extracts: winningHooks, winningAngles, toneKeywords,
 * audiencePainPoints, writingStyle, and a positioning summary.
 *
 * Returns structured enrichment the client can preview and apply to Brand Brain.
 *
 * Cost: 2 AI credits (CONTENT_ANALYSIS)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { checkAndDeductCredits, refundCredits } from '@/lib/credits'
import { UNSUPPORTED_CLAIMS_RULES } from '@/lib/ai/promptRules'
import { guardExtracted } from '@/lib/ai/brandTruthGuard'

export async function POST(req: NextRequest) {
  // Hoisted so any failure below the deduction refunds the user.
  let chargedUserId: string | null = null
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { samples } = body as { samples?: string[] }

    if (!Array.isArray(samples) || samples.filter(s => s?.trim()).length === 0) {
      return NextResponse.json({ error: 'At least one content sample is required' }, { status: 400 })
    }

    // Deduct 2 credits for content analysis
    const creditResult = await checkAndDeductCredits(user.id, 'CONTENT_ANALYSIS')
    if (!creditResult.ok) {
      return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 })
    }
    if (creditResult.creditsUsed > 0) chargedUserId = user.id

    const validSamples = samples.filter(s => s?.trim()).slice(0, 3)
    const combined = validSamples
      .map((s, i) => `--- SAMPLE ${i + 1} ---\n${s.trim().slice(0, 2000)}`)
      .join('\n\n')

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.2,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `You are a content intelligence analyst specializing in brand voice and marketing patterns.
Analyze content samples to extract reusable brand intelligence.
Return ONLY valid JSON. Be specific — extract actual hooks and angles from the text, not generic descriptions.

${UNSUPPORTED_CLAIMS_RULES}

ANALYZER RULES — extract ONLY from the provided samples:
- Do NOT add claims, metrics, testimonials, case studies, or results that are not present in the samples.
- Do NOT convert ad-style copy into proven business facts. A hook that says "double your sales" is the sample's wording, not a verified result.
- If the samples contain numbers/claims, you may quote them as the brand's own copy — but never invent new ones.`,
          },
          {
            role: 'user',
            content: `Analyze these ${validSamples.length} content sample(s) and extract brand intelligence:

${combined}

Return JSON with this exact structure:
{
  "winningHooks": ["exact or paraphrased opening hook from sample 1", "hook from sample 2", ...],
  "winningAngles": ["the core persuasion angle used (e.g. 'transformation story', 'fear of missing out', 'social proof', 'problem-solution')"],
  "toneKeywords": ["adjective describing the tone", "another tone word", ...],
  "audiencePainPoints": ["pain point this content addresses", ...],
  "audienceDesires": ["desired outcome this content promises", ...],
  "writingStyle": "one sentence describing how they write (e.g. 'Short punchy sentences with strong CTAs and emotional triggers')",
  "strategicNotes": "2-3 sentences about the overall content strategy pattern and what makes it effective"
}`,
          },
        ],
      }),
    })

    if (!openaiRes.ok) {
      if (chargedUserId) await refundCredits(chargedUserId, 'CONTENT_ANALYSIS')
      return NextResponse.json({ error: 'AI analysis failed', refunded: !!chargedUserId }, { status: 500 })
    }

    const openaiData = await openaiRes.json()
    const raw = openaiData.choices?.[0]?.message?.content?.trim() || '{}'

    let extracted: Record<string, unknown> = {}
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      extracted = JSON.parse(clean)
    } catch {
      if (chargedUserId) await refundCredits(chargedUserId, 'CONTENT_ANALYSIS', 'Unparseable AI response')
      return NextResponse.json({ error: 'Failed to parse AI response', refunded: !!chargedUserId }, { status: 500 })
    }

    // PR-G: deterministic truth guard. The submitted samples are the allowed
    // source — wording quoted from them is preserved; any invented metrics,
    // proof, or automation claims beyond the samples are scrubbed/downgraded.
    const guarded = guardExtracted(extracted, [combined])

    return NextResponse.json({ extracted: guarded, samplesAnalyzed: validSamples.length })
  } catch (error) {
    console.error('[brand/analyze-content]', error)
    if (chargedUserId) await refundCredits(chargedUserId, 'CONTENT_ANALYSIS')
    return NextResponse.json({ error: 'Internal server error', refunded: !!chargedUserId }, { status: 500 })
  }
}
