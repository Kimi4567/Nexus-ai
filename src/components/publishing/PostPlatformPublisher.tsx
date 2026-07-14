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
  organizations?: Array<{ id: string; name: string }>
  selectedOrganizationId?: string | null
  boards?: Array<{ id: string; name: string }>
  accessTier?: 'TRIAL' | 'STANDARD' | string
}

interface PostPlatformPublisherProps {
  postId: string
  campaignId: string
  platform: string
  status: string
  hasMedia: boolean
  isVideoPost: boolean
  captionLength: number
  caption: string
  onPublished: () => void | Promise<void>
}

function normalizedPlatform(value: string): 'META' | 'LINKEDIN' | 'TIKTOK' | 'X' | 'YOUTUBE' | 'PINTEREST' | 'THREADS' | null {
  const platform = value.toUpperCase()
  if (['META', 'FACEBOOK', 'INSTAGRAM'].includes(platform)) return 'META'
  if (platform === 'LINKEDIN') return 'LINKEDIN'
  if (platform === 'TIKTOK') return 'TIKTOK'
  if (platform === 'X' || platform === 'TWITTER') return 'X'
  if (platform === 'YOUTUBE' || platform === 'YOUTUBE_SHORTS') return 'YOUTUBE'
  if (platform === 'PINTEREST') return 'PINTEREST'
  if (platform === 'THREADS') return 'THREADS'
  return null
}

export function PostPlatformPublisher({ postId, campaignId, platform, status, hasMedia, isVideoPost, captionLength, caption, onPublished }: PostPlatformPublisherProps) {
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
  const [linkedInOrganizationId, setLinkedInOrganizationId] = useState('')
  const [tiktokCreator, setTikTokCreator] = useState<{ privacyLevelOptions: string[]; commentDisabled: boolean; duetDisabled: boolean; stitchDisabled: boolean } | null>(null)
  const [tiktokConsent, setTikTokConsent] = useState(false)
  const [tiktokOptions, setTikTokOptions] = useState({ privacyLevel: '', disableComment: false, disableDuet: false, disableStitch: false, brandContentToggle: false, brandOrganicToggle: true, isAigc: false })
  const [youtubeConsent, setYouTubeConsent] = useState(false)
  const [xConsent, setXConsent] = useState(false)
  const [pinterestConsent, setPinterestConsent] = useState(false)
  const [threadsConsent, setThreadsConsent] = useState(false)
  const [threadsReplyControl, setThreadsReplyControl] = useState<'everyone' | 'accounts_you_follow' | 'mentioned_only'>('everyone')
  const [threadsAltText, setThreadsAltText] = useState(caption.trim().slice(0, 1_000))
  const [pinterestOptions, setPinterestOptions] = useState({
    boardId: '',
    title: caption.trim().split(/\r?\n/)[0]?.slice(0, 100) || '',
    altText: caption.trim().slice(0, 500),
    destinationLink: '',
    aiDisclosureReviewed: false,
    aiModified: false,
    syntheticPerformer: false,
  })
  const [youtubeOptions, setYouTubeOptions] = useState<{
    title: string
    privacyStatus: 'private' | 'unlisted' | 'public'
    madeForKids: '' | 'yes' | 'no'
    syntheticMedia: '' | 'yes' | 'no'
    notifySubscribers: boolean
  }>({ title: '', privacyStatus: 'private', madeForKids: '', syntheticMedia: '', notifySubscribers: false })
  const [result, setResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null)

  // A scheduled post already has an explicit execution decision. Showing a
  // second "publish now" path beside manual/automatic scheduling creates two
  // competing actions and can bypass the reviewed schedule. Immediate provider
  // publishing is therefore available only while the post is APPROVED.
  const eligible = status === 'APPROVED'
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
          setLinkedInOrganizationId(first.selectedOrganizationId || '')
          const firstPage = first.pages?.[0]
          if (firstPage) {
            setPageId(firstPage.igAccountId || firstPage.id)
            setMetaChannel(firstPage.igAccountId ? 'INSTAGRAM' : 'FACEBOOK')
          }
          if (targetPlatform === 'PINTEREST' && first.boards?.length === 1) {
            setPinterestOptions(current => ({ ...current, boardId: first.boards?.[0]?.id || '' }))
          }
          if (targetPlatform === 'TIKTOK') {
            fetch(`/api/social/tiktok/creator-info?integrationId=${encodeURIComponent(first.id)}`, { headers: { Authorization: authHeader() } })
              .then(response => response.ok ? response.json() : Promise.reject(new Error('creator')))
              .then(creatorData => {
                if (cancelled || !creatorData.creator) return
                const creator = creatorData.creator
                setTikTokCreator(creator)
                setTikTokOptions(current => ({
                  ...current,
                  privacyLevel: creator.privacyLevelOptions?.includes('SELF_ONLY') ? 'SELF_ONLY' : creator.privacyLevelOptions?.[0] || '',
                  disableComment: Boolean(creator.commentDisabled),
                  disableDuet: Boolean(creator.duetDisabled),
                  disableStitch: Boolean(creator.stitchDisabled),
                }))
              })
              .catch(() => {})
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
        : targetPlatform === 'LINKEDIN'
          ? linkedInOrganizationId
          : targetPlatform === 'PINTEREST'
            ? pinterestOptions.boardId
            : ''
      const selectedBoard = selectedAccount.boards?.find(board => board.id === pinterestOptions.boardId)
      const response = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socialPostId: postId,
          campaignId,
          integrationId: selectedAccount.id,
          pageId: requestedPageId,
          pageName: targetPlatform === 'PINTEREST' ? selectedBoard?.name : selectedPage?.name || selectedAccount.accountName,
          platform: requestedPlatform,
          platformOptions: targetPlatform === 'TIKTOK'
            ? { ...tiktokOptions, explicitConsent: tiktokConsent }
            : targetPlatform === 'X'
              ? { explicitConsent: xConsent }
            : targetPlatform === 'YOUTUBE'
              ? {
                  title: youtubeOptions.title.trim(),
                  privacyStatus: youtubeOptions.privacyStatus,
                  selfDeclaredMadeForKids: youtubeOptions.madeForKids === 'yes',
                  containsSyntheticMedia: youtubeOptions.syntheticMedia === 'yes',
                  notifySubscribers: youtubeOptions.notifySubscribers,
                  categoryId: '22',
                  explicitConsent: youtubeConsent,
                }
              : targetPlatform === 'PINTEREST'
                ? {
                    boardId: pinterestOptions.boardId,
                    title: pinterestOptions.title.trim(),
                    altText: pinterestOptions.altText.trim(),
                    destinationLink: pinterestOptions.destinationLink.trim() || null,
                    aiDisclosureReviewed: pinterestOptions.aiDisclosureReviewed,
                    aiDisclosureValues: [
                      ...(pinterestOptions.aiModified ? ['AI_MODIFIED'] : []),
                      ...(pinterestOptions.syntheticPerformer ? ['SYNTHETIC_PERFORMER'] : []),
                    ],
                    explicitConsent: pinterestConsent,
                  }
              : targetPlatform === 'THREADS'
                ? {
                    replyControl: threadsReplyControl,
                    altText: threadsAltText.trim(),
                    explicitConsent: threadsConsent,
                  }
              : null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر النشر عبر المنصة.', 'Platform publishing failed.'))
      setResult({
        ok: true,
        message: data.processing
          ? targetPlatform === 'YOUTUBE'
            ? copy('استلم YouTube الفيديو. سيظل قيد المعالجة حتى يؤكد نجاح المعالجة؛ وقد تفرض Google الرؤية الخاصة قبل اعتماد المشروع.', 'YouTube received the video. It remains processing until YouTube confirms success; Google may force Private visibility before project audit approval.')
            : copy('استلمت TikTok الفيديو. سيظل قيد المعالجة حتى تؤكد المنصة النشر.', 'TikTok accepted the video. It remains processing until TikTok confirms publication.')
          : copy('أكدت المنصة النشر وتم تحديث سجل المنشور.', 'Platform confirmed publication and the post ledger was updated.'),
        url: data.platformUrl,
      })
      await onPublished()
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : copy('تعذر النشر عبر المنصة.', 'Platform publishing failed.') })
    } finally {
      setPublishing(false)
    }
  }

  if (!eligible || !targetPlatform || !hasMedia || (['TIKTOK', 'YOUTUBE'].includes(targetPlatform) && !isVideoPost) || (['X', 'PINTEREST', 'THREADS'].includes(targetPlatform) && isVideoPost)) return null

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
                <select value={selectedAccount?.id || ''} onChange={event => { setAccountId(event.target.value); setPageId(''); setPinterestOptions(current => ({ ...current, boardId: '' })) }} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
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
              {targetPlatform === 'LINKEDIN' && (selectedAccount?.organizations?.length || 0) > 0 && (
                <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {copy('هوية النشر', 'Publishing identity')}
                  <select value={linkedInOrganizationId} onChange={event => setLinkedInOrganizationId(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
                    <option value="">{copy('الحساب الشخصي', 'Member profile')}</option>
                    {(selectedAccount?.organizations || []).map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                  </select>
                </label>
              )}
              {targetPlatform === 'TIKTOK' && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('الخصوصية', 'Privacy')}
                    <select value={tiktokOptions.privacyLevel} onChange={event => setTikTokOptions(current => ({ ...current, privacyLevel: event.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
                      <option value="">{copy('اختر الخصوصية', 'Select privacy')}</option>
                      {(tiktokCreator?.privacyLevelOptions || []).map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="flex items-start gap-2 text-[10px] leading-4 text-slate-600">
                    <input type="checkbox" checked={tiktokOptions.isAigc} onChange={event => setTikTokOptions(current => ({ ...current, isAigc: event.target.checked }))} className="mt-0.5" />
                    {copy('وضع علامة أن الوسائط مولّدة بالذكاء الاصطناعي', 'Label the media as AI-generated')}
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] font-black text-slate-700">{copy('إفصاح المحتوى التجاري', 'Commercial content disclosure')}</p>
                    <label className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-slate-600">
                      <input type="checkbox" checked={tiktokOptions.brandOrganicToggle} onChange={event => setTikTokOptions(current => ({ ...current, brandOrganicToggle: event.target.checked }))} className="mt-0.5" />
                      {copy('هذا المحتوى يروّج لعلامتي أو نشاطي التجاري', 'This content promotes my own brand or business')}
                    </label>
                    <label className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-slate-600">
                      <input type="checkbox" checked={tiktokOptions.brandContentToggle} onChange={event => setTikTokOptions(current => ({ ...current, brandContentToggle: event.target.checked }))} className="mt-0.5" />
                      {copy('هذا تعاون مدفوع أو يروّج لطرف ثالث', 'This is paid partnership content or promotes a third party')}
                    </label>
                  </div>
                  <label className="flex items-start gap-2 text-[10px] font-semibold leading-4 text-slate-700">
                    <input type="checkbox" checked={tiktokConsent} onChange={event => setTikTokConsent(event.target.checked)} className="mt-0.5" />
                    {copy('أوافق صراحةً على إرسال هذا الفيديو والنص إلى TikTok الآن.', 'I explicitly consent to sending this video and caption to TikTok now.')}
                  </label>
                </div>
              )}
              {targetPlatform === 'X' && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                  <p className="text-[10px] font-semibold leading-4 text-slate-600">
                    {copy(
                      `سيُنشر النص والصورة المعتمدان فقط. طول النص ${captionLength} من 280 حرفًا، وفيديو X غير مدعوم حاليًا.`,
                      `Only the approved copy and image will be published. Copy length is ${captionLength} of 280 characters; X video is not currently supported.`,
                    )}
                  </p>
                  {captionLength > 280 && (
                    <p className="rounded-lg bg-amber-50 p-2 text-[10px] font-semibold leading-4 text-amber-800">
                      {copy('اختصر النص إلى 280 حرفًا أو أقل قبل النشر.', 'Shorten the copy to 280 characters or fewer before publishing.')}
                    </p>
                  )}
                  <label className="flex items-start gap-2 text-[10px] font-semibold leading-4 text-slate-700">
                    <input type="checkbox" checked={xConsent} disabled={captionLength === 0 || captionLength > 280} onChange={event => setXConsent(event.target.checked)} className="mt-0.5" />
                    {copy('أوافق صراحةً على إرسال هذا النص والصورة المعتمدين إلى حساب X الآن.', 'I explicitly consent to sending this approved copy and image to my X account now.')}
                  </label>
                </div>
              )}
              {targetPlatform === 'YOUTUBE' && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('عنوان الفيديو', 'Video title')}
                    <input value={youtubeOptions.title} maxLength={100} onChange={event => setYouTubeOptions(current => ({ ...current, title: event.target.value }))} placeholder={copy('عنوان واضح ومحدد', 'A clear, specific title')} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800" />
                  </label>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('الخصوصية', 'Privacy')}
                    <select value={youtubeOptions.privacyStatus} onChange={event => setYouTubeOptions(current => ({ ...current, privacyStatus: event.target.value as typeof current.privacyStatus }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
                      <option value="private">{copy('خاص — الأكثر أماناً', 'Private — safest')}</option>
                      <option value="unlisted">{copy('غير مدرج', 'Unlisted')}</option>
                      <option value="public">{copy('عام', 'Public')}</option>
                    </select>
                  </label>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('هل الفيديو موجه للأطفال؟', 'Is this video made for kids?')}
                    <select value={youtubeOptions.madeForKids} onChange={event => setYouTubeOptions(current => ({ ...current, madeForKids: event.target.value as typeof current.madeForKids }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
                      <option value="">{copy('اختر بعد المراجعة', 'Choose after review')}</option>
                      <option value="no">{copy('لا', 'No')}</option>
                      <option value="yes">{copy('نعم', 'Yes')}</option>
                    </select>
                  </label>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('محتوى واقعي معدل أو اصطناعي؟', 'Realistic altered or synthetic content?')}
                    <select value={youtubeOptions.syntheticMedia} onChange={event => setYouTubeOptions(current => ({ ...current, syntheticMedia: event.target.value as typeof current.syntheticMedia }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
                      <option value="">{copy('اختر بعد المراجعة', 'Choose after review')}</option>
                      <option value="no">{copy('لا', 'No')}</option>
                      <option value="yes">{copy('نعم — أضف الإفصاح', 'Yes — disclose it')}</option>
                    </select>
                  </label>
                  <label className="flex items-start gap-2 text-[10px] leading-4 text-slate-600">
                    <input type="checkbox" checked={youtubeOptions.notifySubscribers} onChange={event => setYouTubeOptions(current => ({ ...current, notifySubscribers: event.target.checked }))} className="mt-0.5" />
                    {copy('أرسل إشعاراً للمشتركين إذا سمحت حالة القناة والرؤية بذلك', 'Notify subscribers when channel and visibility rules allow it')}
                  </label>
                  <p className="rounded-lg bg-amber-50 p-2 text-[10px] font-semibold leading-4 text-amber-800">
                    {copy('مشروعات YouTube API غير المعتمدة قد تُجبر الرفع على Private حتى لو اخترت Public.', 'Unaudited YouTube API projects may force uploads to Private even when Public is selected.')}
                  </p>
                  <label className="flex items-start gap-2 text-[10px] font-semibold leading-4 text-slate-700">
                    <input type="checkbox" checked={youtubeConsent} onChange={event => setYouTubeConsent(event.target.checked)} className="mt-0.5" />
                    {copy('أوافق صراحةً على رفع هذا الفيديو والبيانات المعتمدة إلى قناتي على YouTube الآن.', 'I explicitly consent to uploading this approved video and metadata to my YouTube channel now.')}
                  </label>
                </div>
              )}
              {targetPlatform === 'PINTEREST' && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                  {selectedAccount?.accessTier !== 'STANDARD' && (
                    <p className="rounded-lg bg-amber-50 p-2 text-[10px] font-semibold leading-4 text-amber-800">
                      {copy('هذا التطبيق ما زال في Pinterest Trial. يلزم Standard access قبل نشر Pins عامة.', 'This app is still in Pinterest Trial. Standard access is required before publishing public Pins.')}
                    </p>
                  )}
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('اللوحة', 'Board')}
                    <select value={pinterestOptions.boardId} onChange={event => setPinterestOptions(current => ({ ...current, boardId: event.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
                      <option value="">{copy('اختر لوحة النشر', 'Select publishing Board')}</option>
                      {(selectedAccount?.boards || []).map(board => <option key={board.id} value={board.id}>{board.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('عنوان Pin', 'Pin title')}
                    <input value={pinterestOptions.title} maxLength={100} onChange={event => setPinterestOptions(current => ({ ...current, title: event.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-800" />
                  </label>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('النص البديل للصورة', 'Image alt text')}
                    <textarea value={pinterestOptions.altText} maxLength={500} rows={3} onChange={event => setPinterestOptions(current => ({ ...current, altText: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs font-semibold text-slate-800" />
                  </label>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('رابط الوجهة — اختياري', 'Destination URL — optional')}
                    <input type="url" value={pinterestOptions.destinationLink} placeholder="https://" onChange={event => setPinterestOptions(current => ({ ...current, destinationLink: event.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-800" />
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] font-black text-slate-700">{copy('إفصاح الذكاء الاصطناعي', 'AI disclosure')}</p>
                    <label className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-slate-600"><input type="checkbox" checked={pinterestOptions.aiModified} onChange={event => setPinterestOptions(current => ({ ...current, aiModified: event.target.checked }))} className="mt-0.5" />{copy('الصورة الواقعية عُدلت بدرجة كبيرة بالذكاء الاصطناعي', 'The realistic image was substantially AI-modified')}</label>
                    <label className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-slate-600"><input type="checkbox" checked={pinterestOptions.syntheticPerformer} onChange={event => setPinterestOptions(current => ({ ...current, syntheticPerformer: event.target.checked }))} className="mt-0.5" />{copy('تحتوي على مؤدٍ أو شخص اصطناعي', 'It contains a synthetic performer or person')}</label>
                    <label className="mt-2 flex items-start gap-2 text-[10px] font-semibold leading-4 text-slate-700"><input type="checkbox" checked={pinterestOptions.aiDisclosureReviewed} onChange={event => setPinterestOptions(current => ({ ...current, aiDisclosureReviewed: event.target.checked }))} className="mt-0.5" />{copy('راجعت الإفصاح واخترت القيم الصحيحة لهذا التصميم.', 'I reviewed the disclosure and selected the correct values for this creative.')}</label>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-600">{copy(`طول وصف Pin: ${captionLength} من 800 حرف.`, `Pin description length: ${captionLength} of 800 characters.`)}</p>
                  <label className="flex items-start gap-2 text-[10px] font-semibold leading-4 text-slate-700"><input type="checkbox" checked={pinterestConsent} onChange={event => setPinterestConsent(event.target.checked)} className="mt-0.5" />{copy('أوافق صراحةً على نشر الصورة والنص والبيانات المعتمدة إلى هذه اللوحة الآن.', 'I explicitly consent to publishing the approved image, copy, and metadata to this Board now.')}</label>
                </div>
              )}
              {targetPlatform === 'THREADS' && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                  {selectedAccount?.accessTier !== 'LIVE' && (
                    <p className="rounded-lg bg-amber-50 p-2 text-[10px] font-semibold leading-4 text-amber-800">
                      {copy('تطبيق Threads ما زال في وضع التطوير. يلزم تفعيل Live من Meta قبل النشر للمستخدمين عامة.', 'The Threads app is still in Development. Meta Live mode is required before public-user publishing.')}
                    </p>
                  )}
                  <p className="text-[10px] font-semibold leading-4 text-slate-600">{copy(`طول النص: ${captionLength} من 500 حرف.`, `Copy length: ${captionLength} of 500 characters.`)}</p>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('من يستطيع الرد؟', 'Who can reply?')}
                    <select value={threadsReplyControl} onChange={event => setThreadsReplyControl(event.target.value as typeof threadsReplyControl)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
                      <option value="everyone">{copy('الجميع', 'Everyone')}</option>
                      <option value="accounts_you_follow">{copy('الحسابات التي أتابعها', 'Accounts you follow')}</option>
                      <option value="mentioned_only">{copy('الحسابات المذكورة فقط', 'Mentioned accounts only')}</option>
                    </select>
                  </label>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {copy('النص البديل للصورة', 'Image alt text')}
                    <textarea value={threadsAltText} maxLength={1000} rows={3} onChange={event => setThreadsAltText(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs font-semibold text-slate-800" />
                  </label>
                  <label className="flex items-start gap-2 text-[10px] font-semibold leading-4 text-slate-700">
                    <input type="checkbox" checked={threadsConsent} disabled={captionLength === 0 || captionLength > 500 || !threadsAltText.trim()} onChange={event => setThreadsConsent(event.target.checked)} className="mt-0.5" />
                    {copy('أوافق صراحةً على نشر النص والصورة المعتمدين إلى حساب Threads الآن.', 'I explicitly consent to publishing this approved copy and image to my Threads account now.')}
                  </label>
                </div>
              )}
              <button type="button" onClick={publish} disabled={publishing || !selectedAccount || (targetPlatform === 'META' && !selectedPage) || (targetPlatform === 'TIKTOK' && (!tiktokConsent || !tiktokOptions.privacyLevel)) || (targetPlatform === 'X' && (!xConsent || captionLength === 0 || captionLength > 280)) || (targetPlatform === 'YOUTUBE' && (!youtubeConsent || !youtubeOptions.title.trim() || !youtubeOptions.madeForKids || !youtubeOptions.syntheticMedia)) || (targetPlatform === 'PINTEREST' && (selectedAccount.accessTier !== 'STANDARD' || !pinterestConsent || !pinterestOptions.boardId || !pinterestOptions.title.trim() || !pinterestOptions.altText.trim() || !pinterestOptions.aiDisclosureReviewed || captionLength === 0 || captionLength > 800)) || (targetPlatform === 'THREADS' && (selectedAccount.accessTier !== 'LIVE' || !threadsConsent || !threadsAltText.trim() || captionLength === 0 || captionLength > 500))} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
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
