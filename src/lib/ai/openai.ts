/**
 * NEXUS AI — Real OpenAI Integration
 * Model: gpt-4o-mini (fast, cheap, high quality)
 * Uses JSON mode for reliable structured output
 */

import { getLanguageInstruction } from './langHelper'
import { recordOpenAIProviderUsage } from './providerUsageContext'

const MODEL = 'gpt-4o-mini'

// Platform-native tone guides injected into prompts
const PLATFORM_GUIDES: Record<string, string> = {
  TIKTOK: 'TikTok: أسلوب غير رسمي وجذاب، تنسيق POV أو "يوم في حياتي"، الهوك يجب أن يضرب خلال 0-3 ثوانٍ، لغة شبابية، لا رسمية مبالغة.',
  INSTAGRAM: 'Instagram: سرد بصري وإلهامي، هوك الـ Reels في أقل من 3 ثوانٍ، كابشن يستحق الحفظ، محتوى مجتمعي.',
  FACEBOOK: 'Facebook: تنسيق مشكلة/حل، كابشن أطول مقبول، الـ carousel يؤدي جيداً، جمهور 30-55 سنة، إشارات الثقة والمصداقية.',
  YOUTUBE_SHORTS: 'YouTube Shorts: قيمة فورية في الثانية الأولى، محتوى تعليمي أو ترفيهي، هوك شفهي وبصري قوي، CTA واضح في النهاية.',
  LINKEDIN: 'LinkedIn: رؤى مهنية، قيادة فكرية، سرد أطول مقبول، زاوية السلطة والمصداقية، عقلية B2B.',
  SNAPCHAT: 'Snapchat: أصيل وسريع، مدفوع بـ FOMO، أسلوب غير مصقول يبدو حقيقياً، أقل من 10 ثوانٍ مثالياً.',
  Google: 'Google Ads: إعلانات بحث مختصرة وقوية، عنوان جذاب، وصف يحتوي على الكلمة المفتاحية وميزة واضحة.',
  Snapchat: 'Snapchat: محتوى سريع وشبابي، استهداف جمهور الخليج، أسلوب عفوي وحقيقي.',
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = true,
  maxTokens = 4000
): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    console.error('[OpenAI] API error:', response.status, err.slice(0, 300))
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  recordOpenAIProviderUsage(data?.usage)
  const choice = data?.choices?.[0]
  const content = choice?.message?.content
  const finishReason = choice?.finish_reason
  if (!content) throw new Error('OpenAI returned empty response')

  if (jsonMode) {
    // 1. Direct parse (happy path)
    try { return JSON.parse(content) } catch {}

    // 2. Strip markdown code fences and retry (model sometimes wraps JSON despite json_object mode)
    const stripped = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()
    try { return JSON.parse(stripped) } catch {}

    // 3. Extract first {...} block from the content
    const match = content.match(/\{[\s\S]*\}/)
    if (match) { try { return JSON.parse(match[0]) } catch {} }

    // Truncation is the most common real-world cause: the model hit max_tokens
    // and the JSON was cut off mid-structure. Surface it CLEARLY so logs explain
    // the cause (and the fix) instead of a generic "invalid JSON".
    if (finishReason === 'length') {
      console.error(`[OpenAI] Response truncated — hit max_tokens=${maxTokens} (finish_reason=length). Increase max_tokens. Head:`, content.slice(0, 200))
      throw new Error(`OpenAI response truncated at max_tokens=${maxTokens} — output incomplete`)
    }
    console.error(`[OpenAI] JSON parse failed after all attempts (finish_reason=${finishReason}):`, content.slice(0, 300))
    throw new Error('OpenAI returned invalid JSON')
  }
  return content
}

// ─────────────────────────────────────────────
// MARKETING STRATEGY
// ─────────────────────────────────────────────
export async function generateMarketingStrategy(campaign: any, project: any): Promise<any> {
  const langInstruction = getLanguageInstruction(campaign.language)
  const brand = campaign.brandProfile || campaign.workspace?.brandProfile || null
  const platformGuides = (campaign.platforms || [])
    .map((p: string) => PLATFORM_GUIDES[p])
    .filter(Boolean)
    .join('\n')

  const system = `You are a senior marketing strategist building an operating plan for a real business.
Your output must be specific, operational, and honest. Never fill gaps with fake facts.
${langInstruction}
Rules:
- Do not invent competitor names, proof, performance data, budgets, platform readiness, or launch status.
- If a fact is missing, say "Not enough data" and include the missing input in missingData.
- Keep paid media planning separate from launch, spend, publishing, and activation.
- Every content angle must be executable: hook, pain, format, platform, CTA, asset need, and funnel stage.
- Weekly deliverables must be countable and concrete, e.g. "2 Reels about invoice reminders"; never write generic tasks like "create content" or "build awareness".
- Return valid JSON only.`

  const user = `Create a Strategy OS campaign brief. Return ONLY this JSON shape:

{
  "campaignName": "string",
  "goal": "LEADS|SALES|AWARENESS|ENGAGEMENT|TRAFFIC|BRAND_BUILDING",
  "positioning": "Brand is the category for audience who need outcome without frustration",
  "keyMessage": "one belief the audience must accept",
  "differentiation": "specific difference, or Not enough data",
  "targetAudienceRefined": "specific audience situation",
  "businessStage": "pre-launch|early-stage|active|scaling",
  "diagnosis": "2-3 sentences about the real marketing bottleneck",
  "businessObjective": {
    "primary": "business goal",
    "marketing": "marketing objective",
    "conversionAction": "conversion action or Not enough data",
    "expectedUserAction": "specific next action",
    "whyNow": "why this plan matters now",
    "successIn30Days": "realistic non-guaranteed success definition"
  },
  "diagnosisDetails": {
    "stage": "pre-launch|early-stage|active|scaling|recovery",
    "bottleneck": "string",
    "trustGap": "string",
    "offerClarity": "clear|unclear|partial",
    "contentGap": "string",
    "assetReadiness": "string",
    "conversionReadiness": "string",
    "readyForPaidAds": false,
    "readyForPaidAdsReason": "string",
    "mainRisk": "string"
  },
  "audienceSegmentsDetailed": [
    { "segment": "string", "situation": "string", "pain": "string", "desiredOutcome": "string", "objection": "string", "message": "string", "platform": "string", "format": "string", "cta": "string" }
  ],
  "contentPillars": ["4-5 specific pillars"],
  "contentAnglesDetailed": [
    { "title": "string", "pain": "string", "desiredOutcome": "string", "objection": "string", "format": "string", "hook": "string", "platform": "string", "cta": "string", "asset": "string", "funnelStage": "awareness|consideration|conversion", "proofNeeded": "proof or Not enough data", "responseHandoff": "owner and next response or confirmation required", "reviewPoint": "what to check before repeating" }
  ],
  "funnelStages": [
    { "stage": "awareness|consideration|conversion|followUp", "userMindset": "string", "message": "string", "contentType": "string", "platform": "string", "cta": "string", "successMetric": "string", "nextStep": "string", "productArea": "string" }
  ],
  "weeklyExecutionPlan": [
    { "week": 1, "objective": "string", "keyMessage": "string", "deliverables": ["specific deliverable"], "platforms": ["string"], "assetsNeeded": ["string"], "cta": "string", "successMetric": "string", "executionNote": "string", "reviewPoints": ["string"] }
  ],
  "assetRequirements": {
    "mustHave": ["assets required before production"],
    "niceToHave": ["useful supporting assets"],
    "forAds": ["paid assets or explicit planning gaps"],
    "forOrganic": ["organic production assets"],
    "forProof": ["evidence needed before proof claims"],
    "canStartWithout": true,
    "canStartWithoutNote": "what can start safely and what remains blocked",
    "nextToCreate": ["next asset to prepare"]
  },
  "measurementPlan": {
    "primaryOutcome": "outcome to validate",
    "baselineStatus": "existing baseline or state that first cycle establishes it",
    "eventsToTrack": ["observable event"],
    "attributionRule": "how an inquiry or conversion is tied to a source",
    "reportingCadence": "review cadence",
    "owner": "role or owner confirmation required",
    "noDataDecision": "what to do when evidence is insufficient"
  },
  "operatingCadence": {
    "daily": ["monitoring or response task"],
    "weekly": ["review and optimization task"],
    "monthly": ["strategy and Brand Brain learning task"],
    "approvalSla": "proposed approval SLA, not a current-team claim",
    "responseSla": "proposed response SLA",
    "owners": ["role ownership or unconfirmed owner"]
  },
  "experimentBacklog": [
    { "hypothesis": "string", "audience": "string", "variable": "one variable", "successSignal": "observable signal", "minimumEvidence": "evidence needed without invented threshold", "decisionRule": "string", "priority": "now|next|later", "dependency": "string" }
  ],
  "decisionRules": [
    { "signal": "string", "continueWhen": "string", "iterateWhen": "string", "stopWhen": "string", "nextAction": "string" }
  ],
  "roadmap30_60_90": [
    { "phase": "days_1_30", "objective": "string", "deliverables": ["string"], "exitGate": "evidence gate" },
    { "phase": "days_31_60", "objective": "string", "deliverables": ["string"], "exitGate": "evidence gate" },
    { "phase": "days_61_90", "objective": "string", "deliverables": ["string"], "exitGate": "evidence gate" }
  ],
  "competitorFrame": {
    "analysisStatus": "complete|incomplete",
    "providedCompetitors": ["only user-provided competitor names"],
    "differentiationHypotheses": ["hypothesis to validate"],
    "researchNeeded": ["evidence needed to complete comparison"]
  },
  "channelMix": [
    { "platform": "string", "budgetPercent": 0, "rationale": "organic/planning role, no ad spend claim", "contentFrequency": "string" }
  ],
  "topHooks": ["5 brand-specific hooks"],
  "ctaVariations": ["5 specific CTAs"],
  "valueProps": ["3-5 value propositions"],
  "kpis": [
    { "metric": "string", "target": "validation target without invented performance numbers", "timeframe": "string", "isHypothesis": true }
  ],
  "readinessChecklist": [
    { "label": "concrete readiness item", "done": false }
  ],
  "riskNotes": ["real risks and missing inputs"],
  "assumptions": ["explicit assumptions"],
  "missingData": ["missing inputs"],
  "doNotDoYet": ["things not to do yet"],
  "nextBestAction": "one specific next task",
  "estimatedResults": "realistic, non-guaranteed, no fake numbers",
  "readyForPaidAds": false,
  "readyForPaidAdsReason": "string",
  "confidenceReport": { "overall": "high|medium|low", "byCapability": { "contentStrategy": "high|low|none" } },
  "competitorAnalysisComplete": false
}

CAMPAIGN: ${campaign.name} | Goal: ${campaign.goal} | Tone: ${campaign.tone}
Audience: ${campaign.audience || 'Not provided — do not infer audience details'}
Platforms: ${(campaign.platforms || []).join(', ')}
${campaign.description ? `Description: ${campaign.description}` : ''}
${brand?.brandName ? `Brand: ${brand.brandName}` : ''}
${brand?.industry ? `Industry: ${brand.industry}` : ''}
${brand?.description ? `Brand description: ${brand.description}` : ''}
${brand?.primaryOffer ? `Primary offer: ${brand.primaryOffer}` : ''}
${brand?.businessGoal ? `Business goal: ${brand.businessGoal}` : ''}
${brand?.targetAudience ? `Brand audience: ${brand.targetAudience}` : ''}
${brand?.audienceLocation ? `Market/location: ${brand.audienceLocation}` : ''}
${brand?.audiencePainPoints?.length ? `Audience pain points: ${brand.audiencePainPoints.join('; ')}` : ''}
${brand?.audienceDesires?.length ? `Audience desires: ${brand.audienceDesires.join('; ')}` : ''}
${brand?.uniqueAdvantages?.length ? `Unique advantages: ${brand.uniqueAdvantages.join('; ')}` : ''}
${brand?.writingStyle ? `Writing style: ${brand.writingStyle}` : ''}
${brand?.avoidKeywords?.length ? `Avoid words: ${brand.avoidKeywords.join(', ')}` : ''}
${brand?.marketingBudget ? `User-provided marketing budget: ${brand.marketingBudget}` : 'Marketing budget: Not enough data'}
${brand?.conversionDestination ? `Conversion destination: ${brand.conversionDestination}` : 'Conversion destination: Not enough data'}
${brand?.leadHandling ? `Lead handling: ${brand.leadHandling}` : 'Lead handling: Not enough data'}
${brand?.competitors?.length ? `Named competitors: ${brand.competitors.join(', ')}` : 'Named competitors: Not enough data'}
${brand?.verifiedProof?.length ? `Verified proof: ${brand.verifiedProof.join('; ')}` : 'Verified proof: Not enough data'}
${platformGuides ? `Platform context:\n${platformGuides}` : ''}
${campaign.pastLearnings ? `\n${campaign.pastLearnings}` : ''}

Minimum completeness:
- At least 2 audienceSegmentsDetailed
- At least 4 contentAnglesDetailed
- Exactly 4 weeklyExecutionPlan items
- Every audience segment must include segment, situation, pain, desiredOutcome, objection, message, platform, format, and CTA.
- Every content angle must include title, hook, pain, format, platform, CTA, asset, and funnelStage.
- Every content angle must also include desiredOutcome, objection, proofNeeded, responseHandoff, and reviewPoint.
- Every weekly deliverable must be countable and concrete, not generic planning filler.
- At least 3 funnelStages
- At least 3 readinessChecklist items
- At least 2 KPIs, all hypotheses unless real analytics were provided
- At least 3 single-variable experiments, 3 evidence-based decision rules, and all 3 roadmap phases.
- Include a measurement plan and operating cadence; mark unconfirmed owners instead of inventing a team.
- Competitor names may appear only when supplied above. Otherwise keep competitor analysis incomplete.
- Leave budgetBreakdown out unless a budget was explicitly provided.
Be specific to the brand. Real operating guidance, not generic placeholders.
${getLanguageInstruction(campaign.language)}`

  return callOpenAI(system, user, true, 7000)
}

// ─────────────────────────────────────────────
// AD CONCEPTS
// ─────────────────────────────────────────────
export async function generateAdConcepts(campaign: any, project: any): Promise<any[]> {
  const langInstruction = getLanguageInstruction(campaign.language)
  const platforms = campaign.platforms || ['INSTAGRAM']

  const platformGuides = platforms
    .map((p: string) => PLATFORM_GUIDES[p])
    .filter(Boolean)
    .join('\n')

  const system = `You are a top-tier creative director who produces careful, platform-native ad campaign ideas for MENA brands.
You write platform-native scripts — a TikTok script sounds nothing like a LinkedIn post.
You use careful copywriting techniques: pattern interrupts, open loops, proof gaps, specificity, and honest urgency — adapted for MENA audiences.
Your hooks are tested, specific, and platform-native — not generic.
${langInstruction}
Always respond with valid JSON only.`

  const user = `Generate exactly 3 unique ad concepts. Return JSON: { "concepts": [ ...3 items... ] }

Each concept:
{
  "name": "short catchy name",
  "angle": "Pattern Interrupt | Proof Gap | Problem/Solution | Curiosity Gap | Honest Urgency | Transformation",
  "hook": "scroll-stopping opening line, platform-native, ultra-specific (not generic)",
  "script": "40-60 word platform-native ad script covering hook, problem, solution, CTA",
  "cta": "specific action CTA",
  "headlines": ["headline 1", "headline 2"],
  "captions": ["ready-to-post caption with hashtags"],
  "platform": "ONE of: ${platforms.join(' | ')}",
  "format": "Video/Carousel/Static/Reel"
}

CAMPAIGN: ${campaign.name} | Goal: ${campaign.goal} | Audience: ${campaign.audience || 'General'} | Tone: ${campaign.tone}
Platforms: ${platforms.join(', ')}
${campaign.description ? `Description: ${campaign.description}` : ''}
${campaign.brandProfile ? `Brand: ${campaign.brandProfile.brandName || ''} | Avoid: ${(campaign.brandProfile.avoidKeywords || []).join(', ')}` : ''}
${platformGuides ? `Platform guides:\n${platformGuides}` : ''}

3 concepts, 3 different angles. Write real copy, not descriptions.
CRITICAL: ${getLanguageInstruction(campaign.language)}`

  // 3 full Arabic concepts (hook + 40-60 word script + headlines + captions) are
  // the heaviest output here; 3000 prevents mid-JSON truncation under max_tokens.
  const result = await callOpenAI(system, user, true, 3000)
  // Handle both { concepts: [] } and direct array
  if (Array.isArray(result)) return result
  if (result?.concepts) return result.concepts
  return []
}

// ─────────────────────────────────────────────
// BASIC HELPERS (used by other parts of the app)
// ─────────────────────────────────────────────
export async function callOpenAI_raw(prompt: string): Promise<any> {
  return callOpenAI(
    'You are an expert marketing strategist and creative director.',
    prompt,
    false,
    2000
  )
}

export { callOpenAI_raw as callOpenAI }

export async function generateScript(briefing: string): Promise<string> {
  const system = `You are an expert video scriptwriter specializing in short-form social media ads.`
  const user = `Write a compelling 30-60 second video ad script for:

${briefing}

Structure:
[HOOK - first 3 seconds, stops the scroll]
[PROBLEM - identify the pain point]
[SOLUTION - introduce the product/service]
[PROOF - social proof or results]
[CTA - clear call to action]

Return only the script text, no JSON.`

  return callOpenAI(system, user, false, 800)
}

export async function generateCaptions(script: string, platform: string): Promise<string[]> {
  const system = `You are a social media copywriter who writes viral, platform-native captions.`
  const user = `Generate 3 caption variations for ${platform} based on this script:

${script}

Each caption must:
- Be optimized for ${platform}'s algorithm and character limits
- Include relevant hashtags
- Have a clear CTA
- Match the platform's native tone

Return JSON: { "captions": ["caption 1", "caption 2", "caption 3"] }`

  const result = await callOpenAI(system, user, true, 800)
  return result?.captions || []
}
