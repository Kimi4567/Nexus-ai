/**
 * POST /api/visuals/generate
 * Strategy-driven image generation — DALL-E 3 + Cloudinary.
 * Returns the completed visual synchronously (with up to 60s timeout on Vercel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { buildImagePrompt, generateWithDallE, uploadToCloudinary, VisualStyle, VisualType } from '@/lib/ai/imageGen'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export const maxDuration = 60 // Vercel function timeout

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    campaignId,
    visualType = 'HERO' as VisualType,
    visualStyle = 'Premium' as VisualStyle,
    // Campaign context (passed from client)
    campaignName,
    campaignGoal,
    campaignTone,
    audience,
    // Brand context (passed from client)
    brandName,
    brandToneWords,
    primaryOffer,
    industry,
    // Regeneration
    parentId,
  } = body

  // Get workspace
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
  })
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  // Build the strategy-driven prompt
  const prompt = buildImagePrompt({
    visualType,
    visualStyle,
    campaignName,
    campaignGoal,
    campaignTone,
    audience,
    brandName,
    brandToneWords,
    primaryOffer,
    industry,
  })

  // Create the DB record in GENERATING state
  let visual: any
  try {
    visual = await db.generatedVisual.create({
      data: {
        workspaceId: workspace.id,
        campaignId: campaignId || null,
        visualType,
        visualStyle,
        prompt: `${visualStyle} ${visualType.toLowerCase().replace('_', ' ')} for ${campaignName || 'campaign'}`,
        enhancedPrompt: prompt,
        campaignName: campaignName || null,
        campaignGoal: campaignGoal || null,
        campaignTone: campaignTone || null,
        audience: audience || null,
        brandName: brandName || null,
        brandToneWords: brandToneWords || [],
        status: 'GENERATING',
        version: 1,
        parentId: parentId || null,
      },
    })
  } catch (dbErr) {
    console.error('[visuals/generate] DB create error (table may not exist):', dbErr)
    // Table not yet created — run generation anyway and return without DB persistence
    try {
      const dalleUrl = await generateWithDallE(prompt)
      return NextResponse.json({
        visual: {
          id: `temp-${Date.now()}`,
          imageUrl: dalleUrl,
          status: 'COMPLETED',
          visualType,
          visualStyle,
          prompt,
        },
      })
    } catch (genErr: any) {
      return NextResponse.json({ error: genErr.message || 'Generation failed' }, { status: 500 })
    }
  }

  // Run DALL-E generation
  try {
    const dalleUrl = await generateWithDallE(prompt)

    // Persist to Cloudinary
    const publicId = `visual_${visual.id}`
    const permanentUrl = await uploadToCloudinary(dalleUrl, publicId)

    // Update DB to COMPLETED
    const updated = await db.generatedVisual.update({
      where: { id: visual.id },
      data: {
        status: 'COMPLETED',
        imageUrl: permanentUrl,
      },
    })

    return NextResponse.json({ visual: updated })
  } catch (err: any) {
    console.error('[visuals/generate] Generation error:', err)

    // Update DB to FAILED
    await db.generatedVisual.update({
      where: { id: visual.id },
      data: {
        status: 'FAILED',
        errorMessage: err.message || 'Generation failed',
      },
    }).catch(() => {})

    return NextResponse.json({ error: err.message || 'Image generation failed' }, { status: 500 })
  }
}
