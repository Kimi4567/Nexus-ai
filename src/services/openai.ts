/**
 * Client-side AI service — all calls proxied through /api/ai/generate
 * The OpenAI API key is stored server-side in process.env.OPENAI_API_KEY
 * and never exposed to the browser.
 */

import { supabase } from '@/lib/supabaseClient'

async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

async function callAI(action: string, params: Record<string, string>): Promise<string> {
  const token = await getAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...params }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[openai service] Error:', err)
      return err?.error || 'حدث خطأ أثناء إنشاء المحتوى'
    }

    const data = await res.json()
    return data.result || 'لم يتم إنشاء محتوى'
  } catch (err: any) {
    console.error('[openai service] Network error:', err)
    return 'حدث خطأ في الشبكة. يرجى المحاولة مرة أخرى.'
  }
}

export async function generateVideoScript(
  productName: string,
  description: string,
  style: string
): Promise<string> {
  return callAI('video_script', { productName, description, style })
}

export async function generateAdCopy(
  productName: string,
  platform: string,
  objective: string
): Promise<string> {
  return callAI('ad_copy', { productName, platform, objective })
}

export async function analyzeCampaign(data: string): Promise<string> {
  return callAI('analyze', { data })
}
