/**
 * NEXUS AI Engine — Context-aware marketing content generator
 * Used when OPENAI_API_KEY is not set. Generates realistic, valuable marketing content.
 */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

const HOOK_TEMPLATES = {
  SALES: [
    'Stop wasting money on {product} that doesn\'t work.',
    'I saved ${amount} in 30 days by switching to {brand}.',
    'The {product} secret that {industry} doesn\'t want you to know.',
    'Why {number}% of people are doing {topic} completely wrong.',
    'This one change doubled our {metric} in 2 weeks.',
    'POV: You finally found a {product} that actually delivers.',
    'I tested {number} different {products} — this one won.',
    'The honest truth about {product} nobody tells you.',
    'Before you spend another dollar on {topic}, watch this.',
    'From {bad_state} to {good_state} — our customers\' real results.',
  ],
  AWARENESS: [
    'Most people don\'t know this about {topic}.',
    'The truth about {industry} that changes everything.',
    '{brand} is rewriting the rules of {industry}.',
    'What if {benefit} was actually achievable for you?',
    'We\'re on a mission to {mission}.',
    'Meet the {product} changing how people {benefit}.',
    'Behind the scenes of {brand}: how we do things differently.',
    'The problem with {industry} — and how we\'re fixing it.',
    '{number} people already discovered this. Have you?',
    'Something big is coming to {industry}.',
  ],
  LEADS: [
    'Free {resource} reveals how to {benefit}.',
    'Book your free {service} call today — only {number} spots left.',
    'Download the exact {resource} we used to {achievement}.',
    'Get your custom {result} analysis — completely free.',
    'Join {number}+ {audience} who already use {brand}.',
    'Limited: Get our {resource} before we take it down.',
    'We\'ll build your {deliverable} for free — no strings attached.',
    'Your {benefit} roadmap is one click away.',
    '{number}-step guide to {goal} — grab it now.',
    'Real results from real {audience}: see what\'s possible.',
  ],
  ENGAGEMENT: [
    'Hot take: {controversial_opinion}.',
    'Drop a {emoji} if you\'ve ever dealt with {pain_point}.',
    'Tell me I\'m not the only one who {relatable_situation}.',
    'Unpopular opinion about {topic}: {opinion}.',
    'Would you rather: {option_a} or {option_b}?',
    'Rate your current {topic} situation 1-10 in the comments.',
    'This is your sign to finally {action}.',
    'Nobody talks about this part of {topic}.',
    'Genuine question: how do you handle {situation}?',
    'Tag someone who needs to hear this about {topic}.',
  ],
  TRAFFIC: [
    'Click the link to see the full {resource}.',
    'We broke down exactly how to {benefit} — link in bio.',
    'The complete guide is on our website — go check it out.',
    'Everything you need to know about {topic} — link in bio.',
    'See the full guide: how {audience} can approach {goal}.',
    'Free tool alert: {tool} just launched at {brand}.com',
    'Our best {content_type} yet just dropped — link in bio.',
    'Watch the full tutorial on how to {benefit}.',
    '{number} resources to help you {goal} — all free.',
    'Your next step: grab our free {resource} at the link below.',
  ],
}

const CAPTION_TEMPLATES = {
  instagram: [
    '{hook}\n\nHere\'s the thing nobody talks about with {topic} 👇\n\n{point1}\n{point2}\n{point3}\n\nThe result? {outcome}.\n\nSave this for later and share with someone who needs to hear it.\n\n{hashtags}',
    '{hook} ✨\n\nHere are practical lessons for {audience} working toward {goal}:\n\n→ {lesson1}\n→ {lesson2}\n→ {lesson3}\n\nWhich one surprised you most? Comment below 👇\n\n{hashtags}',
    'Real talk: {pain_point} is costing you more than you think. 💭\n\n{brand} exists to change that.\n\n{benefit1} ✅\n{benefit2} ✅\n{benefit3} ✅\n\nLink in bio to get started today.\n\n{hashtags}',
  ],
  tiktok: [
    '{hook} #fyp #viral\n\n{brief_explanation}\n\nFollow for more {topic} tips 🔥',
    'POV: {scenario} ✨ {outcome} #relatable #{industry}tips',
    '{hook} — watch till the end 👀 #{topic} #learnontiktok #{industry}',
  ],
  facebook: [
    '{hook}\n\nWe know how frustrating {pain_point} can be. That\'s why we built {brand}.\n\n✅ {benefit1}\n✅ {benefit2}\n✅ {benefit3}\n\nClick "Learn More" to review the next step.',
    'Attention {audience}: {hook}\n\nProof is strongest when it comes from real customers. Collect verified feedback before using customer quotes in campaigns.\n\nComment "INFO" below and we\'ll reach out.',
  ],
  linkedin: [
    '{hook}\n\nAfter working with {number}+ {industry} professionals, here\'s what I\'ve learned:\n\n1️⃣ {lesson1}\n2️⃣ {lesson2}\n3️⃣ {lesson3}\n\nThe bottom line: {conclusion}\n\nWhat\'s your take? Share in the comments.\n\n#LinkedIn #{industry} #{topic}',
    'I\'ll be honest about {topic}:\n\n{honest_take}\n\nBut here\'s what actually works:\n\n→ {solution1}\n→ {solution2}\n→ {solution3}\n\nSave this post if it was helpful.\n\n#{industry} #Business #Growth',
  ],
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || key)
}

function buildVars(campaign: any, project: any): Record<string, string> {
  const name = campaign.name || 'your brand'
  const goal = campaign.goal || 'SALES'
  const audience = campaign.audience || 'business owners'
  const industry = project?.businessType || campaign.description || 'your industry'

  return {
    brand: name,
    product: name,
    products: name + ' products',
    topic: industry,
    industry: industry,
    audience: audience,
    number: String(Math.floor(Math.random() * 9 + 1) * 1000),
    amount: String(Math.floor(Math.random() * 5 + 1) * 100),
    metric: pick(['revenue', 'conversions', 'leads', 'engagement', 'sales']),
    benefit: pick(['grow faster', 'save time', 'increase revenue', 'scale efficiently', 'stand out']),
    benefit1: pick(['Save hours every week', 'Proven results from day one', 'No experience needed']),
    benefit2: pick(['Trusted by thousands', 'Works for any business size', 'Full support included']),
    benefit3: pick(['Cancel anytime', 'See results in 30 days', 'Risk-free guarantee']),
    result: pick(['more leads', '3x more revenue', 'consistent growth', 'measurable results']),
    outcome: pick(['consistent growth', 'real results', 'measurable impact', 'scalable success']),
    pain_point: pick(['inconsistent results', 'wasted ad spend', 'low engagement', 'slow growth']),
    resource: pick(['guide', 'checklist', 'template', 'blueprint', 'framework']),
    service: pick(['strategy', 'audit', 'consultation', 'discovery']),
    achievement: pick(['10x our leads', 'double our revenue', 'cut costs by 40%', 'scale to 6 figures']),
    deliverable: pick(['strategy', 'roadmap', 'action plan', 'content calendar']),
    lesson1: 'Consistency beats perfection every time',
    lesson2: 'Your audience buys outcomes, not features',
    lesson3: 'The right message to the right person changes everything',
    mission: 'make ' + industry + ' accessible to everyone',
    controversial_opinion: 'most ' + industry + ' advice is completely wrong',
    bad_state: 'struggling',
    good_state: 'thriving',
    point1: '→ ' + pick(['It starts with understanding your customer deeply', 'Your positioning determines everything', 'Content strategy should lead, not follow']),
    point2: '→ ' + pick(['Most businesses skip this critical step', 'The data never lies — but you have to look', 'Simplicity always outperforms complexity']),
    point3: '→ ' + pick(['Small tweaks compound into massive results', 'Your biggest competitor is customer inertia', 'Trust is the only currency that matters']),
    conclusion: 'the brands that win focus on value first, sales second',
    honest_take: 'most ' + industry + ' companies are overcomplicated and underperforming',
    solution1: 'Start with one clear message',
    solution2: 'Test fast, optimize faster',
    solution3: 'Collect verified customer feedback before using proof claims',
    testimonial: 'Verified customer quote to collect before use',
    content_type: pick(['proof collection plan', 'tutorial', 'breakdown', 'analysis']),
    tool: name + ' Analyzer',
    goal: pick(['grow your business', 'generate leads', 'build your brand', 'increase sales']),
    option_a: 'more budget',
    option_b: 'better strategy',
    action: 'invest in your marketing',
    situation: 'a tough week',
    relatable_situation: 'felt like giving up on your goals',
    opinion: 'most people overcomplicate it',
    emoji: '🙋',
    scenario: 'You finally crack the code on ' + industry,
    brief_explanation: 'Here\'s exactly how ' + name + ' makes it simple',
    hashtags: ['#' + industry.replace(/\s/g, ''), '#marketing', '#business', '#growth', '#entrepreneur'].join(' '),
  }
}

export async function callOpenAI(prompt: string): Promise<any> {
  return { mock: true, content: 'AI generation ready — add OPENAI_API_KEY for real content' }
}

export async function generateScript(briefing: string): Promise<string> {
  return `HOOK (0-3s): "${pick(['Stop scrolling.', 'Wait — before you skip this.', 'This changed everything for us.', 'You need to hear this.'])}"

PROBLEM (3-8s): Most ${briefing.slice(0, 50)} solutions are slow, expensive, and complicated.

SOLUTION (8-20s): That's exactly why we built this. [Show product/service in action]
Key benefit 1 → Key benefit 2 → Key benefit 3

PROOF GAP (20-25s): Add a verified customer quote or factual proof point before publishing

CTA (25-30s): Click the link to review the next step.

[TEXT OVERLAY]: ${pick(['Free to start', 'No credit card needed', 'Review the next step', 'Proof to collect'])}`
}

export async function generateCaptions(script: string, platform: string): Promise<string[]> {
  const captions = []
  const templates = CAPTION_TEMPLATES[platform as keyof typeof CAPTION_TEMPLATES] || CAPTION_TEMPLATES.instagram
  for (const template of templates) {
    captions.push(fillTemplate(template, {
      hook: pick(HOOK_TEMPLATES.SALES).replace(/\{[\w]+\}/g, 'your brand'),
      topic: 'marketing',
      hashtags: '#marketing #growth #business #entrepreneur',
      pain_point: 'slow growth',
      brand: 'NEXUS',
      benefit1: 'AI-powered strategy', benefit2: 'Real results', benefit3: 'Easy to use',
      number: '5,000', audience: 'businesses', result: '3x more leads',
      point1: '→ Clarity over complexity', point2: '→ Data-driven decisions', point3: '→ Consistent execution',
      outcome: 'consistent growth', lesson1: 'Focus on one goal', lesson2: 'Test everything',
      testimonial: 'Verified customer quote to collect before use', industry: 'marketing',
    }))
  }
  return captions
}

export async function generateMarketingStrategy(campaign: any, project: any) {
  const vars = buildVars(campaign, project)
  const goal = campaign.goal || 'SALES'
  const platforms = campaign.platforms || ['INSTAGRAM']

  const platformRecs: Record<string, string> = {}
  platforms.forEach((p: string) => {
    const recs: Record<string, string> = {
      INSTAGRAM: 'Reels 3x/week + Stories daily. Carousel posts for education. Strong visual branding.',
      TIKTOK: 'Hook in first 2 seconds. Native, authentic content. Trend sounds + original audio.',
      FACEBOOK: 'Video ads + carousel. Retargeting campaigns. Community building via Groups.',
      YOUTUBE_SHORTS: 'Vertical shorts repurposed from TikTok/Reels. SEO-optimized titles.',
      LINKEDIN: 'Thought leadership posts. Case studies. Employee advocacy. B2B focus.',
      SNAPCHAT: 'Story ads with swipe-up CTA. AR filters for brand awareness.',
    }
    platformRecs[p] = recs[p] || 'Consistent posting with platform-native content style.'
  })

  return {
    overview: `${campaign.name} is positioned to capture ${vars.audience} who are ready for ${vars.result}. The strategy focuses on ${goal === 'SALES' ? 'conversion-optimized content' : goal === 'AWARENESS' ? 'broad reach and brand recognition' : 'lead generation and nurturing'} across ${platforms.length} platform${platforms.length > 1 ? 's' : ''}.`,

    positioning: `${campaign.name} solves the #1 problem of ${vars.audience}: ${vars.pain_point}. Unlike generic solutions, we deliver ${vars.benefit} with a proven system that gets results.`,

    audience: campaign.audience || `Primary: ${vars.audience} aged 25-45 with disposable income and a desire to ${vars.goal}. Secondary: Decision-makers in ${vars.industry} looking for scalable solutions.`,

    valueProps: [
      `${pick(['Saves', 'Recovers', 'Unlocks'])} ${vars.amount} in ${pick(['wasted spend', 'lost time', 'missed revenue'])} per month`,
      `${pick(['Practical', 'Focused', 'Structured'])} system for ${vars.audience}`,
      `${pick(['Review the first 30 days', 'Define ROI baseline first', 'Quick to implement'])} — no long onboarding`,
      `${pick(['Full support included', 'Done-with-you', 'Community access'])} for accountability`,
    ],

    contentPillars: [
      'Education: Teach the problem and solution (40%)',
      'Proof Collection: Customer feedback and verified proof to collect (25%)',
      'Entertainment: Relatable, viral-friendly content (20%)',
      'Conversion: Direct offer and CTA-driven posts (15%)',
    ],

    angles: [
      `Problem-Agitate-Solve: Expose ${vars.pain_point} → amplify the cost → present ${campaign.name} as the fix`,
      `Transformation Plan: Before/after story structure to use only after verified proof exists`,
      `Authority Position: Why ${campaign.name} is the only ${vars.industry} solution that actually works`,
      `FOMO/Urgency: What ${vars.audience} are missing out on by not using ${campaign.name}`,
      `Curiosity: Counterintuitive truths about ${vars.industry} that only ${campaign.name} users know`,
    ],

    platformRecommendations: platformRecs,

    contentCalendar: generateContentCalendar(campaign, platforms),

    metrics: {
      targetCTR: '2.5-4%',
      targetCPL: '$15-45',
      targetROAS: '3-5x',
      expectedReach: `${vars.number} per month`,
      postingFrequency: `${platforms.length * 3}-${platforms.length * 5} posts/week`,
    },

    ctaStrategies: [
      'Primary CTA: "Start free — no credit card needed"',
      'Soft CTA: "Save this post for later"',
      'Engagement CTA: "Comment your biggest challenge with ' + vars.industry + '"',
      'DM CTA: "DM us \'' + pick(['INFO', 'FREE', 'START', 'YES']) + '\' to get started"',
    ],

    risks: [
      'Ad fatigue if same creative runs > 2 weeks — rotate concepts monthly',
      'Platform algorithm changes — diversify across multiple channels',
      'Competitor response — monitor and differentiate on unique strengths',
    ],
  }
}

function generateContentCalendar(campaign: any, platforms: string[]): any[] {
  const goalMap: Record<string, string[]> = {
    SALES: ['Offer post', 'Customer result', 'Product demo', 'Objection handler', 'Urgency post'],
    AWARENESS: ['Brand story', 'Educational post', 'Behind the scenes', 'Team spotlight', 'Mission post'],
    LEADS: ['Lead magnet', 'Freebie offer', 'Webinar invite', 'Case study', 'Quiz/quiz'],
    ENGAGEMENT: ['Question post', 'Poll', 'Meme/humor', 'Hot take', 'User content'],
    TRAFFIC: ['Blog teaser', 'Tutorial clip', 'Resource share', 'Product feature', 'Partnership post'],
  }
  const goal = campaign.goal || 'SALES'
  const types = goalMap[goal] || goalMap.SALES
  const calendar = []

  for (let week = 1; week <= 4; week++) {
    const weekPosts = []
    for (let day = 1; day <= 7; day++) {
      if (day % 2 === 0 || day === 7) continue // post 3-4x/week
      const platform = platforms[Math.floor(Math.random() * platforms.length)]
      const type = types[(week * day) % types.length]
      weekPosts.push({
        day: `Week ${week}, Day ${day}`,
        platform: platform,
        type: type,
        topic: `${type}: ${campaign.name} — ${pick(['value post', 'conversion post', 'engagement post'])}`,
        format: pick(['Reel/Short', 'Carousel', 'Static + Story', 'Video', 'Story Poll']),
      })
    }
    calendar.push({ week: `Week ${week}`, posts: weekPosts })
  }
  return calendar
}

export async function generateAdConcepts(campaign: any, project: any) {
  const vars = buildVars(campaign, project)
  const goal = campaign.goal as keyof typeof HOOK_TEMPLATES || 'SALES'
  const platforms = campaign.platforms || ['INSTAGRAM']
  const hookPool = HOOK_TEMPLATES[goal] || HOOK_TEMPLATES.SALES

  const conceptNames = [
    'The Problem Solver',
    'Social Proof Machine',
    'The Transformation',
    'Curiosity Hook',
    'The Direct Offer',
  ]
  const angles = [
    'Pain Point → Solution',
    'Before & After / Transformation',
    'Counterintuitive Truth',
    'Authority & Trust',
    'Urgency & Scarcity',
  ]

  return conceptNames.map((name, i) => {
    const hook = fillTemplate(hookPool[i % hookPool.length], vars)
    const platform = platforms[i % platforms.length]
    const captionTemplates = CAPTION_TEMPLATES[platform.toLowerCase() as keyof typeof CAPTION_TEMPLATES] || CAPTION_TEMPLATES.instagram
    const rawCaption = captionTemplates[i % captionTemplates.length]

    return {
      name,
      description: `A ${angles[i]}-driven concept targeting ${vars.audience} who struggle with ${vars.pain_point}. Designed specifically for ${platform} to maximize ${goal === 'SALES' ? 'conversions' : goal === 'AWARENESS' ? 'reach' : 'leads'}.`,
      angle: angles[i],
      hook,
      script: `HOOK: "${hook}"\n\nBODY: [Show ${vars.pain_point} scenario] → [Introduce ${campaign.name}] → [Demo key benefit in 15 seconds]\n\nPROOF GAP: "${vars.testimonial}" — collect verified proof before publishing\n\nCTA: "${pick(['Try it free today', 'Get started now', 'Review the offer', 'See the next step'])}"`,
      cta: pick([
        `Try ${campaign.name} free — link in bio`,
        `Book a free call — DM us "${pick(['START', 'FREE', 'GO'])}"`,
        `Get instant access — click the link below`,
        `Join ${vars.number}+ ${vars.audience} — link in bio`,
      ]),
      headlines: [
        hook,
        fillTemplate(hookPool[(i + 2) % hookPool.length], vars),
        `${campaign.name}: ${vars.benefit} — starting today`,
      ],
      captions: [fillTemplate(rawCaption, vars)],
      platform,
      format: pick(['15s Reel', '30s Reel', 'Carousel (5 slides)', 'Story sequence', '60s video']),
      estimatedReach: `${pick(['8K-15K', '12K-25K', '5K-18K', '20K-50K'])} per post`,
    }
  })
}
