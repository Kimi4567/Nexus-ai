'use client'

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import AppShell from '@/components/AppShell'

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
  } else {
    if (file.size > MAX_LOCAL_IMAGE_BYTES) {
      return `Image too large (${formatMB(file.size)} MB). Local upload limit: 3 MB. Enable Cloudinary for larger files.`
    }
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="bg-dark-secondary border border-dark-tertiary rounded-xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-tertiary">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm truncate max-w-xs">{media.fileName}</span>
            <TypeBadge type={media.type} mT={mT} />
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-xl leading-none"
            title={mT.btnClose}
          >
            ✕
          </button>
        </div>

        {/* Media area */}
        <div className="bg-dark flex items-center justify-center min-h-[300px] max-h-[70vh]">
          {isImage && (
            <img
              src={media.url}
              alt={media.fileName}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}
          {isVideo && (
            <video
              controls
              autoPlay={false}
              className="max-w-full max-h-[70vh]"
              poster={
                media.cloudinaryId && CLOUD_NAME
                  ? `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${media.cloudinaryId}.jpg`
                  : undefined
              }
            >
              <source src={media.url} type={media.mimeType} />
            </video>
          )}
          {!isImage && !isVideo && (
            <div className="text-gray-400 text-sm p-8">{media.fileName}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-dark-tertiary">
          <button
            onClick={() => navigator.clipboard.writeText(media.url).catch(() => {})}
            className="rounded border border-dark-tertiary px-3 py-1.5 text-sm text-accent hover:bg-dark-tertiary transition"
          >
            {mT.btnCopyUrl}
          </button>
          <a
            href={media.url}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-dark-tertiary px-3 py-1.5 text-sm text-gray-300 hover:bg-dark-tertiary transition"
          >
            {mT.btnOpen}
          </a>
          <div className="ml-auto text-xs text-gray-500">{media.mimeType}</div>
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
    type === 'VIDEO' ? '#7C3AED' :
    type === 'LOGO'  ? '#059669' :
    type === 'AUDIO' ? '#D97706' : '#2563EB'

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
}: {
  media: MediaRecord
  mT: Record<string, string>
  onPreview: (m: MediaRecord) => void
  onDelete: (id: string) => void
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
    <div className="bg-dark rounded-xl overflow-hidden border border-dark-tertiary flex flex-col">
      {/* Thumbnail */}
      <div
        className="relative w-full h-40 bg-dark-tertiary cursor-pointer overflow-hidden group"
        onClick={() => onPreview(media)}
      >
        {isVideo ? (
          <video
            className="w-full h-full object-cover"
            muted
            preload="metadata"
            poster={
              media.cloudinaryId && CLOUD_NAME
                ? `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${media.cloudinaryId}.jpg`
                : undefined
            }
          >
            <source src={media.url} type={media.mimeType} />
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
        <div className="font-semibold text-sm truncate" title={media.fileName}>{media.fileName}</div>
        <div className="text-xs text-gray-500 truncate">{media.mimeType}</div>

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
                className="flex-1 rounded border border-dark-tertiary text-gray-300 text-xs py-1.5 hover:bg-dark-tertiary transition"
              >
                {mT.confirmNo}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-1.5 mt-auto pt-1">
            <button
              onClick={() => onPreview(media)}
              className="flex-1 rounded border border-dark-tertiary text-accent text-xs py-1.5 hover:bg-dark-tertiary transition"
            >
              {mT.btnPreview}
            </button>
            <button
              onClick={handleCopyUrl}
              className="flex-1 rounded border border-dark-tertiary text-gray-300 text-xs py-1.5 hover:bg-dark-tertiary transition"
            >
              {copyFlash ? '✓' : mT.btnCopyUrl}
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
  const { t } = useI18n()
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
  const [uploadInProgress, setUploadInProgress] = useState(false)
  const dropRef = useRef<HTMLDivElement | null>(null)

  const canUseCloudinary = useMemo(() => Boolean(CLOUD_NAME), [])

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
      // 1. Get signed upload parameters
      const sigRes = await fetch('/api/uploads/cloudinary/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ folder: 'nexus/default' }),
      })
      const { ok: sigOk, data: sigData, errorMsg: sigErr } = await safeJson(sigRes)
      if (!sigOk || !sigData?.signature) {
        throw new Error(sigErr || 'Could not get upload credentials')
      }

      // 2. Upload directly to Cloudinary via XHR (supports progress + large files)
      const resourceType = isVideo ? 'video' : 'auto'
      const form = new FormData()
      form.append('file', file)
      form.append('api_key', sigData.api_key)
      form.append('timestamp', String(sigData.timestamp))
      form.append('signature', sigData.signature)
      form.append('folder', sigData.folder)
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

      // 3. Register in DB
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
          workspaceId: '',
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

      // For images: attempt local fallback
      updateTask(taskId, { error: 'Cloudinary failed, trying local upload...' })
      return uploadToLocal(file, taskId)
    }
  }

  const handleUpload = async (file: File) => {
    // Client-side validation before any network call
    const validationError = validateFile(file, canUseCloudinary)
    if (validationError) {
      const taskId = createUploadTask(file)
      updateTask(taskId, { status: 'FAILED', error: validationError })
      return
    }

    if (uploadInProgress) return
    setUploadInProgress(true)

    const taskId = createUploadTask(file)
    try {
      if (canUseCloudinary) {
        await uploadWithCloudinary(file, taskId)
      } else {
        // No Cloudinary: local images only (already blocked videos in validateFile)
        await uploadToLocal(file, taskId)
      }
    } finally {
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
      if (e.dataTransfer?.files?.length) handleUpload(e.dataTransfer.files[0])
    }
    const onDragOver = (e: DragEvent) => e.preventDefault()
    el.addEventListener('drop', onDrop as any)
    el.addEventListener('dragover', onDragOver as any)
    return () => {
      el.removeEventListener('drop', onDrop as any)
      el.removeEventListener('dragover', onDragOver as any)
    }
  }, [canUseCloudinary, uploadInProgress])

  if (loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-dark-secondary border border-dark-tertiary rounded-lg p-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">{mT?.pageTitle}</h1>
              <p className="text-gray-400 mt-1">{mT?.pageSubtitle}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={mT?.searchPlaceholder}
                className="rounded border border-dark-tertiary bg-dark px-3 py-2 text-sm text-white"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded border border-dark-tertiary bg-dark px-3 py-2 text-sm text-white"
              >
                <option value="ALL">{mT?.filterAll}</option>
                <option value="IMAGE">{mT?.filterImages}</option>
                <option value="VIDEO">{mT?.filterVideos}</option>
              </select>
            </div>
          </div>

          {/* Upload zone */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">{mT?.uploadLabel}</label>
            <div
              ref={dropRef}
              className={`border-2 border-dashed rounded-md p-6 text-center transition ${
                uploadInProgress
                  ? 'border-dark-tertiary opacity-60 cursor-not-allowed'
                  : 'border-dark-tertiary hover:border-accent cursor-pointer'
              }`}
            >
              <input
                id="file-input"
                type="file"
                className="hidden"
                disabled={uploadInProgress}
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime,video/x-m4v"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleUpload(e.target.files[0])
                    e.target.value = '' // reset so same file can be re-selected
                  }
                }}
              />
              <label
                htmlFor="file-input"
                className={`text-sm ${uploadInProgress ? 'text-gray-500 cursor-not-allowed' : 'text-accent cursor-pointer'}`}
              >
                {uploadInProgress ? (mT?.uploadingInProgress || 'Upload in progress…') : mT?.uploadClick}
              </label>
              <div className="text-sm text-gray-400 mt-2">{mT?.uploadDrop}</div>

              {/* Limits note */}
              <div className="text-xs text-gray-500 mt-2">
                {canUseCloudinary
                  ? (mT?.uploadLimitsCloud || 'Images up to 10 MB · Videos up to 100 MB (MP4, MOV, WEBM)')
                  : (mT?.uploadLimitsLocal || 'Images up to 3 MB (local) · Video uploads require Cloudinary')}
              </div>

              {!canUseCloudinary && (
                <div className="text-xs text-yellow-300 mt-1">{mT?.cloudinaryUnavailable}</div>
              )}
            </div>
          </div>

          {/* Upload task queue */}
          {uploadTasks.length > 0 && (
            <div className="mb-6 space-y-3">
              {uploadTasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-dark-tertiary bg-dark p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{task.fileName}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {STATUS_LABELS[task.status] || task.status}
                        {task.status === 'UPLOADING' && task.mimeType.startsWith('video') && (
                          <span className="ml-1 text-gray-500">— {mT?.uploadVideoProgress || 'uploading video, this may take a moment'}</span>
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

                  <div className="mt-3 h-2 rounded-full bg-dark-tertiary overflow-hidden">
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
            <div className="mb-4 text-sm text-red-400">{errorMessage}</div>
          )}

          {/* Media grid */}
          {isLoadingMedia ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-dark rounded-xl border border-dark-tertiary animate-pulse h-52" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {media.length === 0 ? (
                <div className="col-span-full rounded-lg bg-dark p-8 text-center text-gray-400">
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
                  />
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
            <div>
              {mT?.paginationLabel
                ?.replace('{page}', String(page))
                ?.replace('{total}', String(totalPages))}
            </div>
            <div className="flex gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded border border-dark-tertiary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mT?.btnPrevious}
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded border border-dark-tertiary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mT?.btnNext}
              </button>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
