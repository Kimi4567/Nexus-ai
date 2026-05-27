/**
 * Campaign PDF Report Generator
 * Opens a print-ready HTML document in a new tab — the browser renders a
 * professional PDF with zero external dependencies.
 */

interface Concept {
  name: string
  description: string
  angle: string
  hook: string
  script: string
  cta: string
  headlines?: string[]
  captions?: string[]
  platform: string
  format: string
  estimatedReach?: string
}

interface Strategy {
  overview: string
  positioning?: string
  audience?: any
  valueProps?: string[]
  contentPillars?: string[]
  angles?: string[]
  platformRecommendations?: Record<string, string>
  contentCalendar?: any[]
  metrics?: Record<string, string>
  ctaStrategies?: string[]
}

interface CampaignResult {
  campaign: {
    name: string
    goal: string
    audience?: string
    tone?: string
    platforms?: string[]
  }
  strategy: Strategy
  concepts: Concept[]
  generatedAt: string
}

function normalizeAudience(audience: any): string {
  if (!audience) return 'General audience'
  if (typeof audience === 'string') return audience
  if (typeof audience === 'object') {
    const parts: string[] = []
    const str = (v: any): string => {
      if (typeof v === 'string') return v
      if (Array.isArray(v)) return v.join(', ')
      if (typeof v === 'object') return Object.values(v).join(' | ')
      return String(v)
    }
    if (audience.demographics) parts.push(str(audience.demographics))
    if (audience.psychographics) parts.push(str(audience.psychographics))
    return parts.join('. ') || JSON.stringify(audience)
  }
  return String(audience)
}

function escape(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PLATFORM_ICONS: Record<string, string> = {
  INSTAGRAM: '📸', TIKTOK: '🎵', FACEBOOK: '👥',
  YOUTUBE_SHORTS: '▶', LINKEDIN: '💼', SNAPCHAT: '👻',
}

export function generateCampaignPDF(result: CampaignResult): void {
  const { campaign, strategy, concepts, generatedAt } = result
  const date = new Date(generatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const platformList = (campaign.platforms || [])
    .map(p => `${PLATFORM_ICONS[p] || '🌐'} ${p.replace('_', ' ')}`)
    .join(' &nbsp;·&nbsp; ')

  // ── Value Props section ──────────────────────────────────────────────
  const valuePropsHtml = (strategy.valueProps || []).map(vp => `
    <div class="list-item">
      <span class="bullet">→</span>
      <span>${escape(vp)}</span>
    </div>`).join('')

  // ── Content Pillars ──────────────────────────────────────────────────
  const pillarsHtml = (strategy.contentPillars || []).map((p, i) => `
    <div class="pillar pillar-${i % 4}">${escape(p)}</div>`).join('')

  // ── Platform playbook ────────────────────────────────────────────────
  const playbookHtml = Object.entries(strategy.platformRecommendations || {}).map(([plat, rec]) => `
    <div class="playbook-row">
      <span class="platform-badge">${PLATFORM_ICONS[plat] || '📱'} ${plat.replace('_', ' ')}</span>
      <span class="playbook-rec">${escape(String(rec))}</span>
    </div>`).join('')

  // ── CTA Strategies ───────────────────────────────────────────────────
  const ctaHtml = (strategy.ctaStrategies || []).map(cta => `
    <div class="cta-row">
      <span class="cta-arrow">▸</span>
      <span>${escape(cta)}</span>
    </div>`).join('')

  // ── Metrics ──────────────────────────────────────────────────────────
  const metricsHtml = Object.entries(strategy.metrics || {}).map(([key, val]) => `
    <div class="metric-card">
      <div class="metric-value">${escape(String(val))}</div>
      <div class="metric-label">${key.replace(/([A-Z])/g, ' $1').trim()}</div>
    </div>`).join('')

  // ── Ad Concepts ──────────────────────────────────────────────────────
  const conceptsHtml = concepts.map((c, i) => `
    <div class="concept-card${i > 0 ? ' page-break-before' : ''}">
      <div class="concept-header">
        <div>
          <div class="concept-name">${escape(c.name)}</div>
          <div class="concept-meta">
            ${PLATFORM_ICONS[c.platform] || '📱'} ${escape(c.platform)} &nbsp;·&nbsp; ${escape(c.format || '')} &nbsp;·&nbsp; <em>${escape(c.angle)}</em>
            ${c.estimatedReach ? `&nbsp;·&nbsp; ${escape(c.estimatedReach)} reach` : ''}
          </div>
        </div>
        <div class="concept-num">#${i + 1}</div>
      </div>
      <p class="concept-desc">${escape(c.description)}</p>

      <div class="hook-block">
        <div class="block-label">OPENING HOOK</div>
        <div class="hook-text">"${escape(c.hook)}"</div>
      </div>

      ${c.script ? `
      <div class="script-block">
        <div class="block-label">FULL SCRIPT</div>
        <pre class="script-text">${escape(c.script)}</pre>
      </div>` : ''}

      ${c.headlines?.length ? `
      <div class="headlines-block">
        <div class="block-label">HEADLINES</div>
        ${c.headlines.map((h, j) => `<div class="headline-item"><span class="hl-num">${j + 1}.</span> ${escape(h)}</div>`).join('')}
      </div>` : ''}

      ${c.captions?.length ? `
      <div class="captions-block">
        <div class="block-label">CAPTIONS</div>
        ${c.captions.map((cap, j) => `
          <div class="caption-item">
            <div class="caption-num">Caption ${j + 1}</div>
            <div class="caption-text">${escape(cap)}</div>
          </div>`).join('')}
      </div>` : ''}

      <div class="cta-block">
        <span class="block-label" style="margin-right:12px">CTA</span>
        <span class="cta-text">${escape(c.cta)}</span>
      </div>
    </div>`).join('')

  // ── Content Calendar ─────────────────────────────────────────────────
  const calendarHtml = (strategy.contentCalendar || []).map((week: any) => `
    <div class="cal-week">
      <div class="cal-week-title">${escape(week.week || '')}</div>
      <table class="cal-table">
        <thead>
          <tr><th>Day</th><th>Platform</th><th>Type</th><th>Topic</th><th>Format</th></tr>
        </thead>
        <tbody>
          ${(week.posts || []).map((post: any) => `
            <tr>
              <td>${escape(post.day || '')}</td>
              <td>${PLATFORM_ICONS[post.platform] || ''} ${escape(post.platform || '')}</td>
              <td><span class="type-badge">${escape(post.type || '')}</span></td>
              <td>${escape(post.topic || '')}</td>
              <td class="format-cell">${escape(post.format || '')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escape(campaign.name)} — Nexus AI Campaign Report</title>
  <style>
    /* ── Base ──────────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 11pt; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #1a1a2e;
      line-height: 1.6;
    }

    /* ── Layout ────────────────────────────────────────────────────── */
    .page { width: 794px; margin: 0 auto; padding: 0; }
    .section { padding: 32px 48px; border-bottom: 1px solid #eef0f5; }
    .section:last-child { border-bottom: none; }

    /* ── Cover ─────────────────────────────────────────────────────── */
    .cover {
      background: linear-gradient(135deg, #080807 0%, #111110 60%, #1a1a18 100%);
      color: white;
      padding: 64px 48px 48px;
      min-height: 280px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-bottom: 3px solid #FF9500;
    }
    .cover-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 40px;
    }
    .cover-logo {
      width: 32px; height: 32px;
      background: #FF9500;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; color: #080807; font-weight: 900;
    }
    .cover-brand-name {
      font-size: 14pt; font-weight: 700;
      letter-spacing: -0.3px; color: #F5F0E8;
    }
    .cover-title {
      font-size: 28pt; font-weight: 800;
      letter-spacing: -0.8px; line-height: 1.15;
      color: #ffffff; margin-bottom: 12px;
    }
    .cover-sub {
      font-size: 12pt; color: rgba(255,255,255,0.45);
      margin-bottom: 32px;
    }
    .cover-badges {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 32px;
    }
    .cover-badge {
      padding: 4px 12px; border-radius: 20px;
      background: rgba(255,149,0,0.15);
      border: 1px solid rgba(255,149,0,0.3);
      color: #FFB340; font-size: 9pt; font-weight: 600;
    }
    .cover-meta {
      display: flex; gap: 24px;
      font-size: 8.5pt; color: rgba(255,255,255,0.35);
      padding-top: 20px;
      border-top: 1px solid rgba(255,149,0,0.12);
    }

    /* ── Section titles ─────────────────────────────────────────────── */
    .section-label {
      font-size: 7.5pt; font-weight: 700; letter-spacing: 1.8px;
      text-transform: uppercase; color: #FF9500;
      margin-bottom: 6px;
    }
    .section-title {
      font-size: 16pt; font-weight: 800;
      letter-spacing: -0.4px; color: #1a1a18;
      margin-bottom: 16px;
    }

    /* ── Strategy overview ──────────────────────────────────────────── */
    .overview-box {
      background: #fef9f0;
      border-left: 3px solid #FF9500;
      border-radius: 0 8px 8px 0;
      padding: 16px 20px;
      font-size: 11pt; color: #2a2218;
      line-height: 1.7; margin-bottom: 24px;
    }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .col-label { font-size: 7.5pt; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px; }
    .col-text { font-size: 10.5pt; color: #374151; line-height: 1.65; }

    /* ── Value props ─────────────────────────────────────────────────── */
    .list-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 8px 0; border-bottom: 1px solid #f3f4f6;
      font-size: 10.5pt; color: #374151;
    }
    .list-item:last-child { border-bottom: none; }
    .bullet { color: #FF9500; font-weight: 700; flex-shrink: 0; }

    /* ── Content pillars ─────────────────────────────────────────────── */
    .pillars-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .pillar {
      padding: 10px 14px; border-radius: 8px;
      font-size: 10pt; font-weight: 600; line-height: 1.4;
    }
    .pillar-0 { background: #fff8ee; color: #b45309; border: 1px solid #fcd34d; }
    .pillar-1 { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .pillar-2 { background: #fef9f0; color: #c2410c; border: 1px solid #fdba74; }
    .pillar-3 { background: #fafaf9; color: #57534e; border: 1px solid #d6d3d1; }

    /* ── Platform playbook ───────────────────────────────────────────── */
    .playbook-row {
      display: flex; gap: 16px; align-items: flex-start;
      padding: 10px 0; border-bottom: 1px solid #f5f0e8;
      font-size: 10.5pt;
    }
    .playbook-row:last-child { border-bottom: none; }
    .platform-badge {
      flex-shrink: 0; font-weight: 700; color: #c2410c;
      width: 140px; font-size: 10pt;
    }
    .playbook-rec { color: #374151; line-height: 1.55; }

    /* ── Metrics ────────────────────────────────────────────────────── */
    .metrics-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
    .metric-card { background: #fff8ee; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #fde68a; }
    .metric-value { font-size: 14pt; font-weight: 800; color: #FF9500; margin-bottom: 4px; }
    .metric-label { font-size: 7.5pt; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; line-height: 1.3; }

    /* ── CTA strategies ─────────────────────────────────────────────── */
    .cta-row {
      display: flex; gap: 10px; align-items: flex-start;
      padding: 8px 0; border-bottom: 1px solid #f5f0e8;
      font-size: 10.5pt; color: #374151;
    }
    .cta-row:last-child { border-bottom: none; }
    .cta-arrow { color: #FF9500; font-weight: 700; flex-shrink: 0; }

    /* ── Ad concepts ────────────────────────────────────────────────── */
    .concepts-section { padding: 32px 48px; }
    .concept-card {
      border: 1px solid #e8e0d8;
      border-radius: 12px; overflow: hidden;
      margin-bottom: 32px; background: #fafaf9;
    }
    .concept-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      background: linear-gradient(135deg, #080807 0%, #1a1a18 100%);
      border-bottom: 2px solid #FF9500;
      padding: 20px 24px; color: white;
    }
    .concept-name { font-size: 13pt; font-weight: 700; color: #fff; margin-bottom: 5px; }
    .concept-meta { font-size: 9pt; color: rgba(255,255,255,0.5); }
    .concept-num { font-size: 24pt; font-weight: 900; color: rgba(255,149,0,0.35); }
    .concept-desc { padding: 16px 24px 0; font-size: 10.5pt; color: #4b5563; line-height: 1.65; }

    .block-label {
      font-size: 7.5pt; font-weight: 700; letter-spacing: 1.5px;
      text-transform: uppercase; color: #9ca3af; margin-bottom: 6px;
    }
    .hook-block { padding: 16px 24px; background: #fff8ee; margin: 12px 24px 0; border-radius: 8px; border: 1px solid #fde68a; }
    .hook-text { font-size: 12pt; font-weight: 700; color: #c2410c; font-style: italic; }

    .script-block { padding: 0 24px; margin-top: 16px; }
    .script-text {
      font-family: 'Courier New', monospace; font-size: 9.5pt;
      background: #f9fafb; border: 1px solid #e5e7eb;
      border-radius: 6px; padding: 12px 16px;
      white-space: pre-wrap; word-break: break-word;
      color: #374151; line-height: 1.6;
    }

    .headlines-block { padding: 0 24px; margin-top: 16px; }
    .headline-item { font-size: 10.5pt; color: #374151; padding: 4px 0; }
    .hl-num { color: #FF9500; font-weight: 700; margin-right: 4px; }

    .captions-block { padding: 0 24px; margin-top: 16px; }
    .caption-item { padding: 10px 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px; }
    .caption-num { font-size: 7.5pt; color: #9ca3af; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .caption-text { font-size: 10pt; color: #374151; line-height: 1.6; }

    .cta-block {
      display: flex; align-items: center;
      padding: 14px 24px;
      background: #fffbeb; border-top: 1px solid #fde68a;
      margin-top: 16px;
    }
    .cta-text { font-size: 11pt; font-weight: 700; color: #92400e; }

    /* ── Content calendar ───────────────────────────────────────────── */
    .cal-week { margin-bottom: 24px; }
    .cal-week-title {
      font-size: 11pt; font-weight: 700; color: #c2410c;
      margin-bottom: 8px; padding-left: 4px;
    }
    .cal-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    .cal-table th {
      background: #080807; color: rgba(255,255,255,0.65);
      font-weight: 600; font-size: 8pt; letter-spacing: 0.5px;
      text-align: left; padding: 8px 10px;
    }
    .cal-table td {
      padding: 7px 10px; border-bottom: 1px solid #f5f0e8;
      color: #374151; vertical-align: top;
    }
    .cal-table tr:hover td { background: #fff8ee; }
    .type-badge {
      display: inline-block; padding: 2px 7px; border-radius: 12px;
      background: #fff8ee; color: #c2410c; font-size: 8pt; font-weight: 600;
    }
    .format-cell { color: #9ca3af; font-size: 8.5pt; }

    /* ── Footer ─────────────────────────────────────────────────────── */
    .footer {
      background: #080807; color: rgba(255,255,255,0.35);
      padding: 20px 48px; font-size: 8.5pt;
      display: flex; justify-content: space-between; align-items: center;
      border-top: 2px solid #FF9500;
    }
    .footer-brand { color: #FF9500; font-weight: 700; font-size: 9pt; }
    .footer-url { color: rgba(255,255,255,0.2); }

    /* ── Page heading utility ────────────────────────────────────────── */
    .page-break-before { page-break-before: always; }

    /* ── Print overrides ────────────────────────────────────────────── */
    @media print {
      html { font-size: 10pt; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { width: 100%; }
      .cover { min-height: 260px; }
      .no-print { display: none !important; }
    }

    /* ── Print button (screen only) ─────────────────────────────────── */
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #080807; color: rgba(255,255,255,0.7);
      border-bottom: 2px solid #FF9500;
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 24px; font-size: 10pt;
    }
    .print-btn {
      background: #FF9500; color: #080807; border: none; cursor: pointer;
      padding: 7px 20px; border-radius: 6px; font-size: 10pt; font-weight: 700;
      font-family: inherit;
    }
    .print-btn:hover { background: #FFB340; }
    @media print { .print-bar { display: none; } body { padding-top: 0; } }
    @media screen { body { padding-top: 48px; } }
  </style>
</head>
<body>
  <!-- Print bar (screen only) -->
  <div class="print-bar no-print">
    <span>📄 <strong>${escape(campaign.name)}</strong> — Nexus AI Campaign Report</span>
    <button class="print-btn" onclick="window.print()">⬇ Save as PDF</button>
  </div>

  <div class="page">

    <!-- ── COVER ──────────────────────────────────────────────────── -->
    <div class="cover">
      <div class="cover-brand">
        <div class="cover-logo">N</div>
        <span class="cover-brand-name">NEXUS AI</span>
      </div>
      <div>
        <div class="cover-sub">AI-Generated Marketing Campaign Report</div>
        <div class="cover-title">${escape(campaign.name)}</div>
        <div class="cover-badges">
          <span class="cover-badge">🎯 ${escape(campaign.goal)}</span>
          ${campaign.tone ? `<span class="cover-badge">🎨 ${escape(campaign.tone)}</span>` : ''}
          <span class="cover-badge">💡 ${concepts.length} Concepts</span>
          <span class="cover-badge">📅 30-Day Calendar</span>
        </div>
        ${platformList ? `<div style="font-size:10pt;color:rgba(255,255,255,0.45);margin-bottom:8px">${platformList}</div>` : ''}
      </div>
      <div class="cover-meta">
        <span>Generated ${date}</span>
        ${campaign.audience ? `<span>Audience: ${escape(campaign.audience).substring(0, 60)}${campaign.audience.length > 60 ? '…' : ''}</span>` : ''}
        <span>nexus-grow.com</span>
      </div>
    </div>

    <!-- ── STRATEGY OVERVIEW ──────────────────────────────────────── -->
    <div class="section">
      <div class="section-label">01 — Strategy</div>
      <div class="section-title">Campaign Strategy</div>

      <div class="overview-box">${escape(strategy.overview || '')}</div>

      ${strategy.positioning || strategy.audience ? `
      <div class="two-col">
        ${strategy.positioning ? `
        <div>
          <div class="col-label">Positioning</div>
          <div class="col-text">${escape(strategy.positioning)}</div>
        </div>` : ''}
        ${strategy.audience ? `
        <div>
          <div class="col-label">Target Audience</div>
          <div class="col-text">${escape(normalizeAudience(strategy.audience))}</div>
        </div>` : ''}
      </div>` : ''}

      ${valuePropsHtml ? `
      <div class="col-label" style="margin-bottom:8px">Value Propositions</div>
      ${valuePropsHtml}` : ''}
    </div>

    <!-- ── CONTENT PILLARS ────────────────────────────────────────── -->
    ${pillarsHtml ? `
    <div class="section">
      <div class="section-label">02 — Content System</div>
      <div class="section-title">Content Pillars</div>
      <div class="pillars-grid">${pillarsHtml}</div>
    </div>` : ''}

    <!-- ── PLATFORM PLAYBOOK ──────────────────────────────────────── -->
    ${playbookHtml ? `
    <div class="section">
      <div class="section-label">03 — Platform Strategy</div>
      <div class="section-title">Platform Playbook</div>
      ${playbookHtml}
    </div>` : ''}

    <!-- ── TARGET METRICS ────────────────────────────────────────── -->
    ${metricsHtml ? `
    <div class="section">
      <div class="section-label">04 — Success Metrics</div>
      <div class="section-title">Target KPIs</div>
      <div class="metrics-grid">${metricsHtml}</div>
    </div>` : ''}

    <!-- ── CTA STRATEGIES ────────────────────────────────────────── -->
    ${ctaHtml ? `
    <div class="section">
      <div class="section-label">05 — Conversion</div>
      <div class="section-title">CTA Strategies</div>
      ${ctaHtml}
    </div>` : ''}

    <!-- ── AD CONCEPTS ────────────────────────────────────────────── -->
    <div class="concepts-section page-break-before">
      <div class="section-label" style="padding:0">06 — Creative</div>
      <div class="section-title" style="padding:0;margin-bottom:24px">Ad Concepts</div>
      ${conceptsHtml}
    </div>

    <!-- ── CONTENT CALENDAR ───────────────────────────────────────── -->
    ${calendarHtml ? `
    <div class="section page-break-before">
      <div class="section-label">07 — Execution</div>
      <div class="section-title">30-Day Content Calendar</div>
      ${calendarHtml}
    </div>` : ''}

    <!-- ── FOOTER ─────────────────────────────────────────────────── -->
    <div class="footer">
      <span><span class="footer-brand">NEXUS AI</span> — AI-Powered Marketing Platform</span>
      <span class="footer-url">nexus-grow.com · Generated ${date}</span>
    </div>

  </div>

  <script>
    // Auto-print after a short delay to let styles render
    // (only if opened via window.open, not direct navigation)
    if (window.opener) {
      setTimeout(() => window.print(), 800)
    }
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    alert('Please allow pop-ups for this site to download the PDF report.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}
