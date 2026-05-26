import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function callOpenAI(prompt: string): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  })
  const data = await response.json()
  return JSON.parse(data.choices?.[0]?.message?.content || '{}')
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goal, timeframe, platform, budget } = await req.json()

    // Get brand profile for context
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })

    let brandContext = ''
    if (workspace) {
      const brand = await prisma.brandProfile.findFirst({
        where: { workspaceId: workspace.id },
      })
      if (brand) {
        brandContext = `
Brand: ${brand.brandName || 'Not specified'}
Industry: ${brand.industry || 'Not specified'}
Target Audience: ${brand.targetAudience || 'Not specified'}
Brand Tone: ${brand.toneKeywords?.join(', ') || 'Professional'}
Description: ${brand.description || 'Not specified'}
        `.trim()
      }
    }

    const days = timeframe === '30' ? 30 : timeframe === '60' ? 60 : 90
    const weeks = Math.floor(days / 7)

    const prompt = `You are a world-class marketing strategist. Create a detailed ${days}-day marketing strategy.

${brandContext ? `BRAND CONTEXT:\n${brandContext}\n` : ''}
GOAL: ${goal}
TIMEFRAME: ${days} days
PRIMARY PLATFORM: ${platform || 'Multi-platform (Instagram, Facebook, LinkedIn)'}
BUDGET LEVEL: ${budget || 'Bootstrap (organic only)'}

Return a JSON object with this EXACT structure:
{
  "title": "Strategic title for this plan",
  "summary": "2-sentence executive summary",
  "goal": "${goal}",
  "timeframe": "${days} days",
  "themes": [
    {
      "week": 1,
      "title": "Theme title",
      "focus": "What this week focuses on",
      "contentIdeas": ["idea 1", "idea 2", "idea 3"]
    }
  ],
  "pillars": [
    {
      "name": "Content pillar name",
      "description": "What this pillar covers",
      "percentage": 30,
      "examples": ["example 1", "example 2"]
    }
  ],
  "kpis": [
    {
      "metric": "KPI name",
      "target": "Specific target",
      "how": "How to measure"
    }
  ],
  "tactics": [
    {
      "platform": "Platform name",
      "frequency": "X times per week",
      "bestTime": "Best posting time",
      "contentType": "Type of content",
      "tip": "Platform-specific tip"
    }
  ],
  "weeklyPlan": [
    {
      "week": 1,
      "theme": "Week theme",
      "posts": [
        {
          "day": "Monday",
          "platform": "Instagram",
          "type": "Reel",
          "hook": "Post hook/title",
          "caption": "Short caption idea"
        }
      ]
    }
  ],
  "quickWins": ["Quick win you can do today", "Quick win 2", "Quick win 3"],
  "budget": {
    "organic": "Organic strategy advice",
    "paid": "Paid/boost advice if budget allows",
    "tools": ["Free tool 1", "Free tool 2"]
  }
}

Generate ${Math.min(weeks, 4)} week themes and weeklyPlan entries with 5-7 posts per week. Make everything specific and actionable. Return only valid JSON.`

    const strategy = await callOpenAI(prompt)

    return NextResponse.json({ strategy })
  } catch (err: any) {
    console.error('[Strategy generate] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate strategy' }, { status: 500 })
  }
}
