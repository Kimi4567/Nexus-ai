'use client'

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { applyBrandOverlayFromProfile, type OverlayPlatform } from '@/lib/cloudinaryOverlay'
import { useRouter } from 'next/navigation'

// ── Upload limits ──────────────────────────────────────────────────────────────
// Local path goes through Next.js JSON body: file is base64-encoded → 33% overhead.
// Vercel serverless limit is 4.5 MB, so max safe file size is ~3 MB.
// Cloudinary path is a direct browser XHR — no server in the middle.
const MAX_LOCAL_IMAGE_BYTES  = 3  * 1024 * 1024   // 3 MB  (local fallback)
const MAX_CLOUD_IMAGE_BYTES  = 10 * 1024 * 1024   // 10 MB (Cloudinary)
const MAX_CLOUD_VIDEO_BYTES  = 100 * 1024 * 1024  // 100 MB (Cloudinary)

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']

function formatMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1)
}

// Parse a fetch Response safely. Never throws on non-JSON bodies.
async function safeJson(res: Response): Promise<{ ok: boolean; data: any; errorMsg: string }> {
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await res.text().catch(() => '')
    const is413 = res.status === 413 || /too large|entity/i.test(text)
    return {
      ok: false,
      data: null,
      errorMsg: is413
        ? 'Upload failed. This file may be too large for local upload. Use a smaller file or enable Cloudinary.'
        : `Server error (${res.status}). Please try again.`,
    }
  }
  try {
    const data = await res.json()
    return { ok: res.ok && !data?.error, data, errorMsg: data?.error || '' }
  } catch {
    return { ok: false, data: null, errorMsg: `Server error (${res.status})` }
  }
}

// Validate file before any network call
function validateFile(
  file: File,
  hasCloudinary: boolean,
  allowLocal: boolean,
): string | null {
  const isVideo = VIDEO_MIMES.includes(file.type)
  const isImage = IMAGE_MIMES.includes(file.type)

  if (!isVideo && !isImage) {
    return `Unsupported file type: ${file.type || 'unknown'}. Supported: JPEG, PNG, WEBP, GIF, SVG, MP4, WEBM, MOV.`
  }

  if (isVideo) {
    if (!hasCloudinary) {
      return 'Video uploads require Cloudinary storage. Please configure Cloudinary credentials.'
    }
    if (file.size > MAX_CLOUD_VIDEO_BYTES) {
      return `Video too large (${formatMB(file.size)} MB). Maximum: 100 MB.`
    }
    return null
  }

  // Image
  if (hasCloudinary) {
    if (file.size > MAX_CLOUD_IMAGE_BYTES) {
      return `Image too large (${formatMB(file.size)} MB). Maximum: 10 MB.`
    }
  } else if (allowLocal) {
    if (file.size > MAX_LOCAL_IMAGE_BYTES) {
      return `Image too large (${formatMB(file.size)} MB). Local upload limit: 3 MB. Enable Cloudinary for larger files.`
    }
  } else {
    return 'Persistent media storage is not configured. Enable Cloudinary before uploading in production.'
  }

  return null
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface UploadTask {
  id: string
  fileName: string
  mimeType: string
  status: 'PENDING' | 'UPLOADING' | 'SUCCESS' | 'FAILED'
  progress: number
  error?: string
}

interface MediaRecord {
  id: string
  fileName: string
  mimeType: string
  type: string
  url: string
  cloudinaryId?: string
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''

// Returns an MP4-transcoded Cloudinary URL for browser-compatible video playback.
// MOV/QuickTime files are not playable inline in browsers — Cloudinary can transcode
// them to MP4 on-the-fly via the f_mp4 transformation parameter.
function getVideoPlaybackUrl(media: MediaRecord): { src: string; type: string } {
  if (media.cloudinaryId && CLOUD_NAME) {
    return {
      src: `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/f_mp4,q_auto/${media.cloudinaryId}`,
      type: 'video/mp4',
    }
  }
  return { src: media.url, type: media.mimeType }
}

// ── Preview Modal ──────────────────────────────────────────────────────────────
function PreviewModal({
  media,
  onClose,
  mT,
}: {
  media: MediaRecord
  onClose: () => void
  mT: Record<string, string>
}) {
  const isVideo = media.type === 'VIDEO'
  const isImage = media.type === 'IMAGE' || media.type === 'LOGO'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-slate-950 truncate max-w-xs">{media.fileName}</span>
            <TypeBadge type={media.type} mT={mT} />
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition text-xl leading-none"
            title={mT.btnClose}
          >
            ✕
          </button>
        </div>

        {/* Media area */}
        <div className="flex items-center justify-center min-h-[300px] max-h-[70vh]" style={{ background: '#F8FAFC' }}>
          {isImage && (
            <img
              src={media.url}
              alt={media.fileName}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}
          {isVideo && (() => {
            const { src, type } = getVideoPlaybackUrl(media)
            return (
              <video
                key={src}
                controls
                autoPlay={false}
                className="max-w-full max-h-[70vh]"
                poster={
                  media.cloudinaryId && CLOUD_NAME
                    ? `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/so_0/${media.cloudinaryId}.jpg`
                    : undefined
                }
              >
                <source src={src} type={type} />
              </video>
            )
          })()}
          {!isImage && !isVideo && (
            <div className="text-slate-500 text-sm p-8">{media.fileName}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
          <button
            onClick={() => navigator.clipboard.writeText(media.url).catch(() => {})}
            className="rounded-lg px-3 py-1.5 text-sm transition-all" style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)', color: '#5E5CE6' }}
          >
            {mT.btnCopyUrl}
          </button>
          <a
            href={media.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:text-slate-950 transition-all" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }}
          >
            {mT.btnOpen}
          </a>
          <div className="ml-auto text-xs text-slate-500">{media.mimeType}</div>
        </div>
      </div>
    </div>
  )
}

// ── Brand It Modal ─────────────────────────────────────────────────────────────
const PLATFORM_OPTIONS: { value: OverlayPlatform; label: string; labelAr: string; icon: string }[] = [
  { value: 'square',    label: 'Square (Instagram)',  labelAr: 'مربع (إنستجرام)', icon: '▪' },
  { value: 'instagram', label: 'Instagram Feed',      labelAr: 'إنستجرام فيد',    icon: '📷' },
  { value: 'tiktok',   label: 'TikTok / Reels',      labelAr: 'تيكتوك / ريلز',   icon: '🎵' },
  { value: 'linkedin', label: 'LinkedIn',             labelAr: 'لينكدإن',         icon: '💼' },
  { value: 'facebook', label: 'Facebook',             labelAr: 'فيسبوك',          icon: '👤' },
]

function BrandItModal({
  media,
  brand,
  onClose,
  locale,
}: {
  media: MediaRecord
  brand: { brandName?: string | null; logoUrl?: string | null } | null
  onClose: () => void
  locale: string
}) {
  const [platform, setPlatform] = useState<OverlayPlatform>('square')
  const [copyFlash, setCopyFlash] = useState(false)
  const isAr = locale === 'ar'

  const brandedUrl = brand?.brandName
    ? applyBrandOverlayFromProfile(media.url, brand, platform)
    : media.url

  const hasBrand = Boolean(brand?.brandName)
  const isCloudinary = media.url?.includes('res.cloudinary.com')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleCopy = () => {
    navigator.clipboard.writeText(brandedUrl).catch(() => {})
    setCopyFlash(true)
    setTimeout(() => setCopyFlash(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)', boxShadow: '0 24px 80px rgba(15,23,42,0.16)' }}
        onClick={e => e.stopPropagation()}>

        {/* Top accent bar */}
        <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
              style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
              🎨
            </div>
            <span className="font-bold text-sm text-slate-950">
              {isAr ? 'إضافة هوية البراند' : 'Brand This Image'}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition text-lg leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4">

          {/* No brand warning */}
          {!hasBrand && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.22)' }}>
              <span className="text-amber-700 mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#92400E' }}>
                  {isAr ? 'لا يوجد اسم براند' : 'No brand name set'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>
                  {isAr ? 'أضف اسم البراند في Brand Brain أولاً' : 'Add your brand name in Brand Brain first'}
                </p>
              </div>
            </div>
          )}

          {/* Not Cloudinary warning */}
          {!isCloudinary && hasBrand && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.18)' }}>
              <span className="text-red-600 mt-0.5">⚠</span>
              <p className="text-xs" style={{ color: '#B91C1C' }}>
                {isAr
                  ? 'هذه الصورة مش على Cloudinary — الـ overlay بيحتاج صورة مرفوعة عبر المنصة'
                  : 'This image is not on Cloudinary — overlay requires an image uploaded through the platform'}
              </p>
            </div>
          )}

          {/* Platform selector */}
          {isCloudinary && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block"
                style={{ color: '#64748B' }}>
                {isAr ? 'المنصة' : 'Platform'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORM_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setPlatform(opt.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: platform === opt.value ? '#F5F3FF' : '#FFFFFF',
                      border: `1px solid ${platform === opt.value ? 'rgba(94,92,230,0.35)' : 'rgba(15,23,42,0.10)'}`,
                      color: platform === opt.value ? '#5E5CE6' : '#64748B',
                    }}>
                    {opt.icon} {isAr ? opt.labelAr : opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image preview */}
          <div className="rounded-xl overflow-hidden flex items-center justify-center"
            style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)', minHeight: 280 }}>
            <img
              key={brandedUrl}
              src={brandedUrl}
              alt={media.fileName}
              className="max-w-full max-h-[400px] object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
            />
          </div>

          {/* Brand info chips */}
          {hasBrand && (
            <div className="flex flex-wrap gap-2 text-xs">
              {brand?.brandName && (
                <span className="px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)', color: '#5E5CE6' }}>
                  ✦ {isAr ? 'الاسم:' : 'Name:'} {brand.brandName}
                </span>
              )}
              {brand?.logoUrl && (
                <span className="px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: '#ECFDF5', border: '1px solid rgba(5,150,105,0.18)', color: '#047857' }}>
                  ✦ {isAr ? 'اللوجو مضاف' : 'Logo applied'}
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <a href={brandedUrl} download target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: hasBrand && isCloudinary ? '#111827' : '#F1F5F9',
                color: hasBrand && isCloudinary ? '#fff' : '#64748B',
                boxShadow: 'none',
                pointerEvents: (!hasBrand || !isCloudinary) ? 'none' : 'auto',
              }}>
              ⬇ {isAr ? 'تحميل' : 'Download'}
            </a>
            <button onClick={handleCopy}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)', color: copyFlash ? '#047857' : '#475569' }}>
              {copyFlash ? '✓ ' : ''}{isAr ? 'نسخ الرابط' : 'Copy URL'}
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)', color: '#475569' }}>
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Type Badge ─────────────────────────────────────────────────────────────────
function TypeBadge({ type, mT }: { type: string; mT: Record<string, string> }) {
  const label =
    type === 'VIDEO' ? mT.typeVideo :
    type === 'IMAGE' ? mT.typeImage :
    type === 'LOGO'  ? mT.typeLogo  :
    type === 'AUDIO' ? mT.typeAudio : type

  const color =
    type === 'VIDEO' ? '#8B5CF6' :
    type === 'LOGO'  ? '#10B981' :
    type === 'AUDIO' ? '#F97316' : '#06B6D4'

  return (
    <span
      style={{ background: color + '22', color, border: `1px solid ${color}44`, fontSize: 10 }}
      className="rounded-full px-2 py-0.5 font-medium uppercase tracking-wide"
    >
      {label}
    </span>
  )
}

// ── Media Card ─────────────────────────────────────────────────────────────────
function MediaCard({
  media,
  mT,
  onPreview,
  onDelete,
  onBrandIt,
}: {
  media: MediaRecord
  mT: Record<string, string>
  onPreview: (m: MediaRecord) => void
  onDelete: (id: string) => void
  onBrandIt: (m: MediaRecord) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copyFlash, setCopyFlash] = useState(false)
  const { authHeader } = useAuth()

  const isVideo = media.type === 'VIDEO'

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(media.url).catch(() => {})
    setCopyFlash(true)
    setTimeout(() => setCopyFlash(false), 1500)
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/media/${media.id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader() },
      })
      if (res.ok) {
        onDelete(media.id)
      } else {
        console.error('Delete failed', res.status)
        setDeleting(false)
        setConfirmDelete(false)
      }
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden flex flex-col transition-all hover:shadow-nx-card" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      {/* Thumbnail */}
      <div
        className="relative w-full h-40 cursor-pointer overflow-hidden group" style={{ background: '#F8FAFC' }}
        onClick={() => onPreview(media)}
      >
        {isVideo ? (
          <video
            className="w-full h-full object-cover"
            muted
            preload="metadata"
            poster={
              media.cloudinaryId && CLOUD_NAME
                ? `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/so_0/${media.cloudinaryId}.jpg`
                : undefined
            }
          >
            {(() => { const { src, type } = getVideoPlaybackUrl(media); return <source src={src} type={type} /> })()}
          </video>
        ) : (
          <img
            src={media.url}
            alt={media.fileName}
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
          <span className="text-white text-sm font-medium">{mT.btnPreview}</span>
        </div>
        <div className="absolute top-2 left-2">
          <TypeBadge type={media.type} mT={mT} />
        </div>
      </div>

      {/* Info + Actions */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="font-semibold text-sm text-slate-950 truncate" title={media.fileName}>{media.fileName}</div>
        <div className="text-xs text-slate-500 truncate">{media.mimeType}</div>

        {confirmDelete ? (
          <div className="mt-1">
            <div className="text-xs text-red-400 mb-2">{mT.confirmDeleteMsg}</div>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 transition disabled:opacity-60"
              >
                {deleting ? '...' : mT.confirmYes}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-lg text-xs py-1.5 text-slate-600 hover:text-slate-950 transition-all" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }}
              >
                {mT.confirmNo}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-1.5 mt-auto pt-1">
            <button
              onClick={() => onPreview(media)}
              className="flex-1 rounded-lg text-xs py-1.5 transition-all" style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)', color: '#5E5CE6' }}
            >
              {mT.btnPreview}
            </button>
            {!isVideo && (
              <button
                onClick={(e) => { e.stopPropagation(); onBrandIt(media) }}
                className="flex-1 rounded-lg text-xs py-1.5 font-semibold transition-all"
                style={{ background: '#ECFEFF', border: '1px solid rgba(8,145,178,0.18)', color: '#0891B2' }}
                title="Brand It">
                🎨 Brand
              </button>
            )}
            <button
              onClick={handleCopyUrl}
              className="rounded-lg text-xs py-1.5 px-2 text-slate-500 hover:text-slate-950 transition-all" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }}
            >
              {copyFlash ? '✓' : '⎘'}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded border border-red-900/50 text-red-400 text-xs py-1.5 px-2.5 hover:bg-red-900/20 transition"
              title={mT.btnDelete}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MediaLibraryPage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const router = useRouter()
  const { t, locale } = useI18n()
  const mT = t('media') as Record<string, string>

  const STATUS_LABELS: Record<string, string> = {
    PENDING:   mT?.statusPending   || 'Pending',
    UPLOADING: mT?.statusUploading || 'Uploading',
    SUCCESS:   mT?.statusSuccess   || 'Uploaded',
    FAILED:    mT?.statusFailed    || 'Failed',
  }

  const [media, setMedia] = useState<MediaRecord[]>([])
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([])
  const [isLoadingMedia, setIsLoadingMedia] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(24)
  const [totalPages, setTotalPages] = useState(1)
  const [previewMedia, setPreviewMedia] = useState<MediaRecord | null>(null)
  const [brandItMedia, setBrandItMedia] = useState<MediaRecord | null>(null)
  const [brandProfile, setBrandProfile] = useState<{ brandName?: string | null; logoUrl?: string | null } | null>(null)
  const [uploadInProgress, setUploadInProgress] = useState(false)
  const uploadInProgressRef = useRef(false) // ref-based guard for sequential multi-file uploads
  const dropRef = useRef<HTMLDivElement | null>(null)

  const canUseCloudinary = useMemo(() => Boolean(CLOUD_NAME), [])
  const canUseLocalUploads = useMemo(() => process.env.NODE_ENV !== 'production', [])

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/auth/login')
  }, [loading, isAuthenticated, router])

  const loadMedia = useCallback(async (currentPage = 1, currentQuery = '', currentType = 'ALL') => {
    setIsLoadingMedia(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(pageSize) })
      if (currentQuery) params.set('query', currentQuery)
      if (currentType !== 'ALL') params.set('type', currentType)
      const res = await fetch(`/api/media?${params.toString()}`, {
        headers: { Authorization: authHeader() },
      })
      const { ok, data, errorMsg } = await safeJson(res)
      if (ok && data?.media) {
        setMedia(data.media)
        setTotalPages(data.pagination?.pages || 1)
      } else {
        setErrorMessage(errorMsg || 'Unable to load media')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Unable to load media')
    } finally {
      setIsLoadingMedia(false)
    }
  }, [authHeader, pageSize])

  useEffect(() => {
    if (!isAuthenticated) return
    loadMedia(page, query, typeFilter)
  }, [isAuthenticated, page, typeFilter])

  // Fetch brand profile for Brand It overlay
  useEffect(() => {
    if (!isAuthenticated) return
    fetch('/api/brand', { headers: { Authorization: authHeader() } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.brandProfile) setBrandProfile(d.brandProfile) })
      .catch(() => {})
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const timeout = setTimeout(() => loadMedia(1, query, typeFilter), 400)
    return () => clearTimeout(timeout)
  }, [query])

  const updateTask = (id: string, changes: Partial<UploadTask>) => {
    setUploadTasks((tasks) => tasks.map((task) => (task.id === id ? { ...task, ...changes } : task)))
  }

  const createUploadTask = (file: File): string => {
    const id = `${Date.now()}-${file.name}`
    setUploadTasks((tasks) => [
      { id, fileName: file.name, mimeType: file.type, status: 'PENDING', progress: 0 },
      ...tasks,
    ])
    return id
  }

  // Local upload — images only, ≤3 MB (base64 JSON body constraint)
  const uploadToLocal = async (file: File, taskId: string): Promise<boolean> => {
    updateTask(taskId, { status: 'UPLOADING', progress: 10 })
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onerror = () => {
        updateTask(taskId, { status: 'FAILED', error: 'Failed to read file' })
        resolve(false)
      }
      reader.onload = async () => {
        const base = (reader.result as string).split(',')[1]
        try {
          updateTask(taskId, { progress: 50 })
          const res = await fetch('/api/uploads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
            body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: base, workspaceId: '' }),
          })
          const { ok, data, errorMsg } = await safeJson(res)
          if (ok && data?.media) {
            setMedia((prev) => [data.media, ...prev])
            updateTask(taskId, { status: 'SUCCESS', progress: 100 })
            resolve(true)
          } else {
            updateTask(taskId, { status: 'FAILED', error: errorMsg || 'Local upload failed' })
            resolve(false)
          }
        } catch (err: any) {
          console.error('Local upload error', err)
          updateTask(taskId, { status: 'FAILED', error: err?.message || 'Local upload failed' })
          resolve(false)
        }
      }
      reader.readAsDataURL(file)
    })
  }

  // Cloudinary upload — images and videos, direct browser XHR
  const uploadWithCloudinary = async (file: File, taskId: string): Promise<boolean> => {
    const isVideo = VIDEO_MIMES.includes(file.type)
    updateTask(taskId, { status: 'UPLOADING', progress: 0 })

    try {
      // 1. Create a short-lived, workspace-bound upload session
      const sessionRes = await fetch('/api/uploads/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({
          resourceType: isVideo ? 'video' : 'auto',
          fileName: file.name,
        }),
      })
      const { ok: sessionOk, data: sessionData, errorMsg: sessionErr } = await safeJson(sessionRes)
      if (!sessionOk || !sessionData?.sessionToken) {
        throw new Error(sessionErr || 'Could not create upload session')
      }

      // 2. Get signed upload parameters for that exact session
      const sigRes = await fetch('/api/uploads/cloudinary/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ sessionToken: sessionData.sessionToken }),
      })
      const { ok: sigOk, data: sigData, errorMsg: sigErr } = await safeJson(sigRes)
      if (!sigOk || !sigData?.signature) {
        throw new Error(sigErr || 'Could not get upload credentials')
      }

      // 3. Upload directly to Cloudinary via XHR (supports progress + large files)
      const resourceType = isVideo ? 'video' : 'auto'
      const form = new FormData()
      form.append('file', file)
      form.append('api_key', sigData.api_key)
      form.append('timestamp', String(sigData.timestamp))
      form.append('signature', sigData.signature)
      form.append('folder', sigData.folder)
      form.append('public_id', sigData.public_id)
      form.append('overwrite', String(sigData.overwrite))
      form.append('resource_type', resourceType)

      const cloudinaryResponse = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            // Reserve last 10% for DB registration
            updateTask(taskId, { progress: Math.round((e.loaded / e.total) * 90) })
          }
        }

        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300 && parsed.secure_url) {
              resolve(parsed)
            } else {
              reject(new Error(parsed?.error?.message || `Cloudinary error (${xhr.status})`))
            }
          } catch {
            reject(new Error(`Cloudinary response parse error (${xhr.status})`))
          }
        }
        xhr.onerror = () => reject(new Error('Cloudinary network error'))
        xhr.send(form)
      })

      // 4. Register in DB after server-side Cloudinary verification
      updateTask(taskId, { progress: 95 })
      const mimeGuess = file.type ||
        (cloudinaryResponse.resource_type === 'video' ? `video/${cloudinaryResponse.format}` : `image/${cloudinaryResponse.format}`)

      const notifyRes = await fetch('/api/uploads/cloudinary/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({
          fileName: cloudinaryResponse.original_filename || cloudinaryResponse.public_id,
          mimeType: mimeGuess,
          secureUrl: cloudinaryResponse.secure_url,
          publicId: cloudinaryResponse.public_id,
          bytes: cloudinaryResponse.bytes,
          resourceType: cloudinaryResponse.resource_type,
          sessionToken: sessionData.sessionToken,
        }),
      })
      const { ok: notifyOk, data: notifyData, errorMsg: notifyErr } = await safeJson(notifyRes)
      if (!notifyOk || !notifyData?.media) {
        throw new Error(notifyErr || 'Failed to register media in database')
      }

      setMedia((prev) => [notifyData.media, ...prev])
      updateTask(taskId, { status: 'SUCCESS', progress: 100 })
      return true
    } catch (err: any) {
      console.error('Cloudinary upload failed', err)
      const msg = err?.message || 'Cloudinary upload failed'

      if (isVideo) {
        // Never fall back to local for videos — it will always fail on Vercel
        updateTask(taskId, { status: 'FAILED', error: msg })
        return false
      }

      // Local disk is a development-only fallback. Production uses ephemeral
      // serverless storage and must fail clearly instead of pretending an
      // upload was persisted.
      if (!canUseLocalUploads) {
        updateTask(taskId, { status: 'FAILED', error: 'Cloudinary is required for persistent uploads in production.' })
        return false
      }

      // For development images: attempt local fallback
      updateTask(taskId, { error: 'Cloudinary failed, trying local upload...' })
      return uploadToLocal(file, taskId)
    }
  }

  const handleUpload = async (file: File) => {
    // Client-side validation before any network call
    const validationError = validateFile(file, canUseCloudinary, canUseLocalUploads)
    if (validationError) {
      const taskId = createUploadTask(file)
      updateTask(taskId, { status: 'FAILED', error: validationError })
      return
    }

    // Use ref for guard so sequential multi-file uploads don't get blocked by stale React state
    if (uploadInProgressRef.current) return
    uploadInProgressRef.current = true
    setUploadInProgress(true)

    const taskId = createUploadTask(file)
    try {
      if (canUseCloudinary) {
        await uploadWithCloudinary(file, taskId)
      } else if (canUseLocalUploads) {
        // No Cloudinary: local images only in development.
        await uploadToLocal(file, taskId)
      } else {
        updateTask(taskId, {
          status: 'FAILED',
          error: 'Cloudinary is required for persistent uploads in production.',
        })
      }
    } finally {
      uploadInProgressRef.current = false
      setUploadInProgress(false)
    }
  }

  const handleRetry = (task: UploadTask) => {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = task.mimeType
    fileInput.onchange = async () => {
      if (fileInput.files?.[0]) {
        setUploadTasks((tasks) => tasks.filter((item) => item.id !== task.id))
        await handleUpload(fileInput.files![0])
      }
    }
    fileInput.click()
  }

  const handleMediaDeleted = useCallback((id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id))
    if (previewMedia?.id === id) setPreviewMedia(null)
  }, [previewMedia])

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        // Upload all dropped files sequentially
        const fileArray = Array.from(files)
        const uploadSequentially = async () => {
          for (const file of fileArray) {
            await handleUpload(file)
          }
        }
        uploadSequentially()
      }
    }
    const onDragOver = (e: DragEvent) => e.preventDefault()
    el.addEventListener('drop', onDrop as any)
    el.addEventListener('dragover', onDragOver as any)
    return () => {
      el.removeEventListener('drop', onDrop as any)
      el.removeEventListener('dragover', onDragOver as any)
    }
  }, [canUseCloudinary, canUseLocalUploads, uploadInProgress])

  if (loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!isAuthenticated) return null

  return (
    <AppShell>
      {previewMedia && (
        <PreviewModal
          media={previewMedia}
          onClose={() => setPreviewMedia(null)}
          mT={mT}
        />
      )}

      {brandItMedia && (
        <BrandItModal
          media={brandItMedia}
          brand={brandProfile}
          onClose={() => setBrandItMedia(null)}
          locale={locale}
        />
      )}

      <main className="relative min-h-screen bg-[#f6f8fc] text-[#071236]">
          <div className="relative mx-auto max-w-[1540px] px-6 py-7 lg:px-8">
            <div>

          <LuxuryWorkspaceHeader
            pageTitle={locale === 'ar' ? 'مكتبة الوسائط' : 'Media Library'}
            pageSubtitle={locale === 'ar' ? 'ارفع الصور والفيديوهات، ثم اربطها بالمنشور المناسب من مركز المحتوى.' : 'Upload images and videos, then attach them to the right post from Content Hub.'}
            primaryHref="/content-hub"
            primaryLabel={locale === 'ar' ? 'مراجعة المحتوى' : 'Review content'}
            secondaryHref="/studio"
            secondaryLabel={locale === 'ar' ? 'استوديو الإبداع' : 'Creative Studio'}
          />

          <div className="nx-os-action-strip mb-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="nx-os-icon-box" aria-hidden="true">🖼️</span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-[#111b3f]">{locale === 'ar' ? `${media.length} أصل ظاهر` : `${media.length} visible assets`}</p>
                <p className="text-[11px] font-semibold text-[#7b87a3]">{locale === 'ar' ? 'الإرفاق النهائي يتم من مركز المحتوى.' : 'Final attachment happens in Content Hub.'}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={mT?.searchPlaceholder}
                aria-label={mT?.searchPlaceholder}
                className="h-11 rounded-[15px] px-4 text-[13px] font-bold text-[#111b3f] outline-none transition-all placeholder:text-[#8a96ad]" style={{ background: '#FFFFFF', border: '1px solid #dfe6f2' }}
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label={locale === 'ar' ? 'نوع الوسائط' : 'Media type'}
                className="h-11 rounded-[15px] px-4 text-[13px] font-bold text-[#111b3f] outline-none transition-all" style={{ background: '#FFFFFF', border: '1px solid #dfe6f2' }}
              >
                <option value="ALL">{mT?.filterAll}</option>
                <option value="IMAGE">{mT?.filterImages}</option>
                <option value="VIDEO">{mT?.filterVideos}</option>
              </select>
            </div>
          </div>

          {/* Upload zone */}
          <div className="mb-6 rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="block text-[16px] font-black text-[#071236]">{mT?.uploadLabel}</label>
              <span className="rounded-full bg-[#f4f6ff] px-3 py-1 text-[11px] font-black text-[#5366f6]">
                {canUseCloudinary ? 'Cloudinary' : 'Local'}
              </span>
            </div>
            <div
              ref={dropRef}
              className="rounded-[22px] p-10 text-center transition-all"
              style={{
                background: '#fbfcff',
                border: uploadInProgress ? '2px dashed rgba(148,163,184,0.30)' : '2px dashed rgba(83,102,246,0.28)',
                opacity: uploadInProgress ? 0.6 : 1,
                cursor: uploadInProgress ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                id="file-input"
                type="file"
                multiple
                className="hidden"
                disabled={uploadInProgress}
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime,video/x-m4v"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    // Upload all selected files sequentially
                    const files = Array.from(e.target.files)
                    const uploadSequentially = async () => {
                      for (const file of files) {
                        await handleUpload(file)
                      }
                    }
                    uploadSequentially()
                    e.target.value = '' // reset so same files can be re-selected
                  }
                }}
              />
              <label
                htmlFor="file-input"
                className={`text-[17px] font-black ${uploadInProgress ? 'text-slate-400 cursor-not-allowed' : 'cursor-pointer'}`} style={{ color: uploadInProgress ? undefined : '#5366f6' }}
              >
                {uploadInProgress ? (mT?.uploadingInProgress || 'Upload in progress…') : mT?.uploadClick}
              </label>
              <div className="mt-2 text-[13px] font-bold text-[#64708f]">{mT?.uploadDrop}</div>

              {/* Limits note */}
              <div className="mt-2 text-[12px] font-bold text-[#8a96ad]">
                {canUseCloudinary
                  ? (mT?.uploadLimitsCloud || 'Images up to 10 MB · Videos up to 100 MB (MP4, MOV, WEBM)')
                  : canUseLocalUploads
                    ? (mT?.uploadLimitsLocal || 'Images up to 3 MB (local development only) · Video uploads require Cloudinary')
                    : 'Cloudinary is required for persistent media uploads in production.'}
              </div>

              {!canUseCloudinary && (
                <div className="text-xs text-amber-700 mt-1">
                  {canUseLocalUploads
                    ? mT?.cloudinaryUnavailable
                    : 'Configure Cloudinary to enable persistent media uploads.'}
                </div>
              )}
            </div>
          </div>

          {/* Upload task queue */}
          {uploadTasks.length > 0 && (
            <div className="mb-6 space-y-3">
              {uploadTasks.map((task) => (
                <div key={task.id} className="rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-slate-950 truncate">{task.fileName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {STATUS_LABELS[task.status] || task.status}
                        {task.status === 'UPLOADING' && task.mimeType.startsWith('video') && (
                          <span className="ml-1 text-slate-400">— {mT?.uploadVideoProgress || 'uploading video, this may take a moment'}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {task.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(task)}
                          className="text-accent text-xs hover:underline"
                        >
                          {mT?.btnRetry}
                        </button>
                      )}
                    </div>
                  </div>

                  {task.error && (
                    <div className="mt-2 text-xs text-red-400 leading-relaxed">{task.error}</div>
                  )}

                  <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full transition-all ${task.status === 'FAILED' ? 'bg-red-500' : task.status === 'SUCCESS' ? 'bg-green-500' : 'bg-accent'}`}
                      style={{ width: `${task.status === 'FAILED' ? 100 : task.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 text-sm text-red-600">{errorMessage}</div>
          )}

          {/* Media grid */}
          {isLoadingMedia ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-52 animate-pulse rounded-[22px]" style={{ background: '#FFFFFF', border: '1px solid #e3e8f3' }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {media.length === 0 ? (
                <div className="col-span-full rounded-[24px] p-12 text-center text-[14px] font-bold text-[#64708f]" style={{ background: '#FFFFFF', border: '1px solid #e3e8f3' }}>
                  {mT?.noMedia}
                </div>
              ) : (
                media.map((m) => (
                  <MediaCard
                    key={m.id}
                    media={m}
                    mT={mT}
                    onPreview={setPreviewMedia}
                    onDelete={handleMediaDeleted}
                    onBrandIt={setBrandItMedia}
                  />
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <div>
              {mT?.paginationLabel
                ?.replace('{page}', String(page))
                ?.replace('{total}', String(totalPages))}
            </div>
            <div className="flex gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:text-slate-950 transition-all disabled:cursor-not-allowed disabled:opacity-30" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }}
              >
                {mT?.btnPrevious}
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:text-slate-950 transition-all disabled:cursor-not-allowed disabled:opacity-30" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }}
              >
                {mT?.btnNext}
              </button>
            </div>
          </div>

            </div>
          </div>
        </main>
    </AppShell>
  )
}
