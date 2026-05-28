const API_KEY = typeof window !== 'undefined' ? localStorage.getItem('openai_key') || '' : ''

async function callOpenAI(systemPrompt: string, userMessage: string): Promise<string> {
  if (!API_KEY) {
    return `[Demo Mode] ${systemPrompt.slice(0, 40)}...`
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'Error'
}

export async function generateVideoScript(productName: string, description: string, style: string): Promise<string> {
  return callOpenAI(
    'أنت كاتب سكريبت فيديو محترف. اكتب سكريبت جذاب بالعربية.',
    `اكتب سكريبت فيديو تسويقي لـ "${productName}". الوصف: ${description}. الأسلوب: ${style}.`
  )
}

export async function generateAdCopy(productName: string, platform: string, objective: string): Promise<string> {
  return callOpenAI(
    'أنت كاتب إعلانات محترف. اكتب نسخة إعلانية بالعربية.',
    `اكتب 3 نسخ إعلانية لـ "${productName}" على ${platform}. الهدف: ${objective}.`
  )
}

export async function analyzeCampaign(data: string): Promise<string> {
  return callOpenAI(
    'أنت محلل تسويق. قدم تحليل وتوصيات بالعربية.',
    `حلل هذه البيانات: ${data}`
  )
}
