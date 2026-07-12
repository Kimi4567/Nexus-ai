'use client'

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { CheckCircle2, ExternalLink, Loader2, Send, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

interface ConnectedPage {
  id: string
  name: string
  igAccountId?: string | null
}

interface ConnectedAccount {
  id: string
  platform: string
  accountName?: string | null
  pages?: ConnectedPage[]
}

interface PostPlatformPublisherProps {
  postId: string
  campaignId: string
  platform: string
  status: string
  hasMedia: boolean
  onPublished: () => void | Promise<void>
}

function normalizedPlatform(value: string): 'META' | 'LINKEDIN' | 'TIKTOK' | null {
  const platform = value.toUpperCase()
  if (['META', 'FACEBOOK', 'INSTAGRAM'].includes(platform)) return 'META'
  if (platform === 'LINKEDIN') return 'LINKEDIN'
  if (platform === 'TIKTOK') return 'TIKTOK'
  return null
}

export function PostPlatformPublisher({ postId, campaignId, platform, status, hasMedia, onPublished }: PostPlatformPublisherProps) {
  const { authHeader } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const copy = (arabic: string, english: string) => (ar ? arabic : english)
  const targetPlatform = normalizedPlatform(platform)
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null)
  const [accountId, setAccountId] = useState('')
  const [pageId, setPageId] = useState('')
  const [metaChannel, setMetaChannel] = useState<'FACEBOOK' | 'INSTAGRAM'>('INSTAGRAM')
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null)

  const eligible = status === 'APPROVED' || status === 'SCHEDULED'
  const matchingAccounts = useMemo(() => (accounts || []).filter(account => account.platform.toUpperCase() === targetPlatform), [accounts, targetPlatform])
  const selectedAccount = matchingAccounts.find(account => account.id === accountId) || matchingAccounts[0] || null
  const pages = selectedAccount?.pages || []
  const selectedPage = pages.find(page => page.id === pageId || page.igAccountId === pageId) || pages[0] || null

  useEffect(() => {
    if (!open || accounts !== null) return
    let cancelled = false
    fetch('/api/social/accounts', { headers: { Authorization: authHeader() } })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('accounts')))
      .then(data => {
        if (cancelled) return
        const next = Array.isArray(data.accounts) ? data.accounts : []
        setAccounts(next)
        const first = next.find((account: ConnectedAccount) => account.platform.toUpperCase() === targetPlatform)
        if (first) {
          setAccountId(first.id)
          const firstPage = first.pages?.[0]
          if (firstPage) {
            setPageId(firstPage.igAccountId || firstPage.id)
            setMetaChannel(firstPage.igAccountId ? 'INSTAGRAM' : 'FACEBOOK')
          }
        }
      })
      .catch(() => { if (!cancelled) setAccounts([]) })
    return () => { cancelled = true }
  }, [accounts, authHeader, open, targetPlatform])

  async function publish() {
    if (!selectedAccount || !targetPlatform || (targetPlatform === 'META' && !selectedPage)) return
    setPublishing(true)
    setResult(null)
    try {
      const requestedPlatform = targetPlatform === 'META' ? metaChannel : targetPlatform
      const requestedPageId = targetPlatform === 'META'
        ? (metaChannel === 'INSTAGRAM' ? selectedPage?.igAccountId || '' : selectedPage?.id || '')
        : ''
      const response = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socialPostId: postId,
          campaignId,
          integrationId: selectedAccount.id,
          pageId: requestedPageId,
          pageName: selectedPage?.name || selectedAccount.accountName,
          platform: requestedPlatform,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر النشر عبر المنصة.', 'Platform publishing failed.'))
      setResult({ ok: true, message: copy('أكدت المنصة النشر وتم تحديث سجل المنشور.', 'Platform confirmed publication and the post ledger was updated.'), url: data.platformUrl })
      await onPublished()
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : copy('تعذر النشر عبر المنصة.', 'Platform publishing failed.') })
    } finally {
      setPublishing(false)
    }
  }

  if (!eligible || !targetPlatform) return null

  return (
    <div className="border-t border-slate-200 px-3 pb-3 pt-2">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          <Send size={14} /> {copy('نشر هذا المنشور عبر API', 'Publish this post through the platform API')}
        </button>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-slate-900">{copy('تأكيد نشر المنصة', 'Confirm platform publishing')}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-600">{copy('سيستخدم NEXUS النص والوسائط المعتمدة المحفوظة، وليس نسخة جديدة من المتصفح.', 'NEXUS will use the saved approved copy and media, not a new browser-side version.')}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label={copy('إغلاق', 'Close')}><XCircle size={16} /></button>
          </div>

          {accounts === null ? (
            <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500"><Loader2 size={13} className="animate-spin" />{copy('جار تحميل الحسابات...', 'Loading accounts...')}</div>
          ) : matchingAccounts.length === 0 ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-700">
              {copy('لا يوجد حساب متصل يطابق منصة هذا المنشور.', 'No connected account matches this post platform.')}
              <Link href="/connections" className="mt-2 flex items-center gap-1 font-black underline">{copy('اربط الحساب', 'Connect account')}<ExternalLink size={11} /></Link>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                {copy('الحساب', 'Account')}
                <select value={selectedAccount?.id || ''} onChange={event => { setAccountId(event.target.value); setPageId('') }} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
                  {matchingAccounts.map(account => <option key={account.id} value={account.id}>{account.accountName || account.platform}</option>)}
                </select>
              </label>
              {targetPlatform === 'META' && (
                <>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('الصفحة', 'Page')}
                    <select value={selectedPage?.id || ''} onChange={event => { const page = pages.find(item => item.id === event.target.value); setPageId(page?.igAccountId || page?.id || '') }} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
                      {pages.map(page => <option key={page.id} value={page.id}>{page.name}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setMetaChannel('FACEBOOK')} className={`h-9 rounded-lg border text-[11px] font-black ${metaChannel === 'FACEBOOK' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Facebook</button>
                    <button type="button" onClick={() => setMetaChannel('INSTAGRAM')} disabled={!selectedPage?.igAccountId} className={`h-9 rounded-lg border text-[11px] font-black disabled:cursor-not-allowed disabled:opacity-40 ${metaChannel === 'INSTAGRAM' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Instagram</button>
                  </div>
                </>
              )}
              {!hasMedia && targetPlatform === 'META' && <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-semibold text-amber-700">{copy('قد تتطلب المنصة وسائط صالحة لهذا النوع من المنشورات.', 'The platform may require valid media for this post type.')}</p>}
              <button type="button" onClick={publish} disabled={publishing || !selectedAccount || (targetPlatform === 'META' && !selectedPage)} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {copy('تأكيد النشر الآن', 'Confirm publish now')}
              </button>
            </div>
          )}

          {result && <div className={`mt-3 rounded-lg border p-2 text-[10px] font-semibold ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}><div className="flex items-start gap-2">{result.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}<span>{result.message}</span></div>{result.url && <a href={result.url} target="_blank" rel="noreferrer" className="mt-1 block underline">{copy('فتح المنشور', 'Open published post')}</a>}</div>}
        </div>
      )}
    </div>
  )
}
