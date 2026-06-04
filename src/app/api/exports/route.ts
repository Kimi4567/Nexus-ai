/**
 * POST /api/exports
 * Generates a real campaign export file, uploads to Supabase Storage,
 * and returns a 7-day signed download URL.
 *
 * Supported formats: HTML (printable), JSON (data)
 * Upgrade path: add PDF renderer (puppeteer / react-pdf) later.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { adminClient } from '@/lib/supabaseAuth'

// ── HTML template ──────────────────────────────────────────────────────────────
function buildCampaignHTML(campaign: any): string {
  const strategy   = campaign.aiOutput?.strategy ?? campaign.strategy ?? {}
  const concepts   = campaign.concepts   ?? []
  const generations = campaign.generations ?? []

  const goal      = campaign.goal      ?? '—'
  const audience  = campaign.audience  ?? '—'
  const tone      = campaign.tone      ?? '—'
  const platforms = (campaign.platforms ?? []).join(', ') || '—'

  // Strategy sections
  const positioning  = strategy.positioning  ?? strategy.brandPositioning  ?? ''
  const hooks        = Array.isArray(strategy.hooks)      ? strategy.hooks      : []
  const captions     = Array.isArray(strategy.captions)   ? strategy.captions   : []
  const cta          = strategy.cta           ?? strategy.callToAction ?? ''
  const contentCalendar = Array.isArray(strategy.contentCalendar) ? strategy.contentCalendar : []

  const hooksHTML = hooks.length
    ? `<ul>${hooks.map((h: string) => `<li>${h}</li>`).join('')}</ul>`
    : '<p class="empty">No hooks generated yet.</p>'

  const captionsHTML = captions.length
    ? `<ul>${captions.map((c: string) => `<li>${c}</li>`).join('')}</ul>`
    : '<p class="empty">No captions generated yet.</p>'

  const calendarHTML = contentCalendar.length
    ? `<table><thead><tr><th>Day</th><th>Platform</th><th>Content</th></tr></thead><tbody>
        ${contentCalendar.map((item: any) =>
          `<tr><td>${item.day ?? item.date ?? '—'}</td><td>${item.platform ?? '—'}</td><td>${item.content ?? item.caption ?? '—'}</td></tr>`
        ).join('')}
       </tbody></table>`
    : '<p class="empty">No calendar entries yet.</p>'

  const conceptsHTML = concepts.length
    ? concepts.map((c: any) => `
        <div class="concept-card">
          <h4>${c.name ?? 'Concept'}</h4>
          ${c.description ? `<p>${c.description}</p>` : ''}
          ${c.headline    ? `<p><strong>Headline:</strong> ${c.headline}</p>` : ''}
          ${c.body        ? `<p><strong>Body:</strong> ${c.body}</p>` : ''}
          ${c.cta         ? `<p><strong>CTA:</strong> ${c.cta}</p>` : ''}
        </div>`).join('')
    : '<p class="empty">No concepts generated yet.</p>'

  const generationsHTML = generations.length
    ? `<p>${generations.length} generation(s) — content stored in platform.</p>`
    : '<p class="empty">No generations yet.</p>'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${campaign.name} — Nexus AI Campaign Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; }
    .header { background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: #fff; border-radius: 12px; padding: 40px; margin-bottom: 32px; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header .meta { font-size: 13px; opacity: 0.7; }
    .badge { display: inline-block; background: rgba(255,255,255,0.15); border-radius: 6px; padding: 4px 12px; font-size: 12px; margin-right: 8px; }
    .section { background: #fff; border-radius: 10px; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
    .section h2 { font-size: 16px; font-weight: 700; color: #6d28d9; margin-bottom: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; }
    .section h3 { font-size: 14px; font-weight: 600; color: #334155; margin: 16px 0 8px; }
    .section p, .section li { font-size: 14px; line-height: 1.7; color: #475569; }
    .section ul { padding-left: 20px; }
    .section ul li { margin-bottom: 6px; }
    .empty { color: #94a3b8; font-style: italic; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .info-item { background: #f8fafc; border-radius: 8px; padding: 14px; }
    .info-item .label { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .info-item .value { font-size: 15px; font-weight: 600; color: #1e293b; }
    .concept-card { background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 3px solid #6d28d9; }
    .concept-card h4 { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; font-weight: 600; color: #475569; padding: 10px 12px; text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 32px; }
    @media print { body { background: #fff; } .section { box-shadow: none; border: 1px solid #e2e8f0; } }
  </style>
</head>
<body>

<div class="header">
  <h1>${campaign.name}</h1>
  <div class="meta">Generated by Nexus AI · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  <div style="margin-top:12px;">
    <span class="badge">${goal}</span>
    <span class="badge">${tone}</span>
    <span class="badge">${platforms}</span>
  </div>
</div>

<div class="section">
  <h2>Campaign Overview</h2>
  <div class="info-grid">
    <div class="info-item"><div class="label">Goal</div><div class="value">${goal}</div></div>
    <div class="info-item"><div class="label">Tone</div><div class="value">${tone}</div></div>
    <div class="info-item"><div class="label">Platforms</div><div class="value">${platforms}</div></div>
    <div class="info-item"><div class="label">Target Audience</div><div class="value">${audience}</div></div>
  </div>
</div>

${positioning ? `
<div class="section">
  <h2>Brand Positioning</h2>
  <p>${positioning}</p>
</div>` : ''}

<div class="section">
  <h2>Hooks</h2>
  ${hooksHTML}
</div>

<div class="section">
  <h2>Caption Library</h2>
  ${captionsHTML}
</div>

${cta ? `
<div class="section">
  <h2>Call to Action</h2>
  <p>${typeof cta === 'string' ? cta : JSON.stringify(cta)}</p>
</div>` : ''}

<div class="section">
  <h2>Content Calendar</h2>
  ${calendarHTML}
</div>

<div class="section">
  <h2>Ad Concepts</h2>
  ${conceptsHTML}
</div>

<div class="section">
  <h2>AI Generations</h2>
  ${generationsHTML}
</div>

<div class="footer">
  Nexus AI · nexus-grow.com · Exported ${new Date().toISOString()}
</div>

</body>
</html>`
}

// ── Main handler ───────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const userId = await getServerUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = { id: userId }
    const body = await request.json()
    const { campaignId, format = 'HTML', type = 'full_campaign' } = body

    // Validate campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        workspace: { ownerId: user.id },
      },
      include: {
        concepts: true,
        generations: true,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Create export record (PROCESSING state)
    const exportRecord = await prisma.export.create({
      data: {
        workspaceId: campaign.workspaceId,
        campaignId,
        format,
        type,
        status: 'PROCESSING',
        itemsCount: (campaign.concepts.length || 0) + (campaign.generations.length || 0),
      },
    })

    // ── Generate file content ─────────────────────────────────────────────────
    let fileContent: string
    let contentType: string
    let ext: string

    if (format === 'JSON') {
      fileContent = JSON.stringify({
        exportedAt: new Date().toISOString(),
        campaign: {
          id: campaign.id,
          name: campaign.name,
          goal: campaign.goal,
          audience: campaign.audience,
          tone: campaign.tone,
          platforms: campaign.platforms,
          strategy: campaign.aiOutput ?? campaign.strategy,
          concepts: campaign.concepts,
          generationsCount: campaign.generations.length,
        },
      }, null, 2)
      contentType = 'application/json'
      ext = 'json'
    } else {
      // Default: HTML (printable to PDF from browser)
      fileContent = buildCampaignHTML(campaign)
      contentType = 'text/html; charset=utf-8'
      ext = 'html'
    }

    const fileSizeBytes = Buffer.byteLength(fileContent, 'utf8')
    const storagePath   = `exports/${user.id}/${exportRecord.id}.${ext}`

    // ── Upload to Supabase Storage ────────────────────────────────────────────
    const { error: uploadError } = await adminClient.storage
      .from('nexus-exports')
      .upload(storagePath, Buffer.from(fileContent, 'utf8'), {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      // If bucket doesn't exist yet, fall back to a data-URI download approach
      console.error('[Exports] Supabase upload error:', uploadError.message)

      // Mark as failed and surface useful error
      await prisma.export.update({
        where: { id: exportRecord.id },
        data: { status: 'FAILED' },
      })

      return NextResponse.json(
        { error: 'Storage upload failed. Please contact support.' },
        { status: 500 }
      )
    }

    // ── Create signed URL (7 days) ────────────────────────────────────────────
    const { data: signedData, error: signError } = await adminClient.storage
      .from('nexus-exports')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60) // 7 days in seconds

    if (signError || !signedData?.signedUrl) {
      console.error('[Exports] Signed URL error:', signError?.message)
      await prisma.export.update({
        where: { id: exportRecord.id },
        data: { status: 'FAILED' },
      })
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // ── Update export record as READY ─────────────────────────────────────────
    await prisma.export.update({
      where: { id: exportRecord.id },
      data: {
        status: 'READY',
        url: signedData.signedUrl,
        fileSize: fileSizeBytes,
        completedAt: new Date(),
        expiresAt,
      },
    })

    return NextResponse.json({
      id: exportRecord.id,
      url: signedData.signedUrl,
      format: ext.toUpperCase(),
      fileSizeBytes,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error: any) {
    console.error('[Exports] Error:', error?.message || error)
    return NextResponse.json({ error: 'Failed to create export' }, { status: 500 })
  }
}
