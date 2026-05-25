'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '@/components/AppShell'

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

export default function MediaLibraryPage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [media, setMedia] = useState<MediaRecord[]>([])
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([])
  const [isLoadingMedia, setIsLoadingMedia] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(24)
  const [totalPages, setTotalPages] = useState(1)
  const dropRef = useRef<HTMLDivElement | null>(null)

  const canUseCloudinary = useMemo(() => Boolean(CLOUD_NAME), [])

  const loadMedia = async (currentPage = 1, currentQuery = '', currentType = 'ALL') => {
    setIsLoadingMedia(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(pageSize) })
      if (currentQuery) params.set('query', currentQuery)
      if (currentType !== 'ALL') params.set('type', currentType)
      const res = await fetch(`/api/media?${params.toString()}`, {
        headers: { Authorization: authHeader() },
      })
      const data = await res.json()
      if (data.media) {
        setMedia(data.media)
        setTotalPages(data.pagination?.pages || 1)
      } else {
        setErrorMessage(data.error || 'Unable to load media')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Unable to load media')
    } finally {
      setIsLoadingMedia(false)
    }
  }

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

  const createUploadTask = (file: File) => {
    const task: UploadTask = {
      id: `${Date.now()}-${file.name}`,
      fileName: file.name,
      mimeType: file.type,
      status: 'PENDING',
      progress: 0,
    }
    setUploadTasks((tasks) => [task, ...tasks])
    return task.id
  }

  const uploadToLocal = async (file: File, taskId: string) => {
    updateTask(taskId, { status: 'UPLOADING', progress: 0 })
    const reader = new FileReader()

    reader.onload = async () => {
      const base = (reader.result as string).split(',')[1]
      try {
        const res = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: base, workspaceId: '' }),
        })
        const data = await res.json()
        if (data.media) {
          setMedia((prev) => [data.media, ...prev])
          updateTask(taskId, { status: 'SUCCESS', progress: 100 })
        } else {
          throw new Error(data.error || 'Local upload failed')
        }
      } catch (err: any) {
        console.error('Upload failed', err)
        updateTask(taskId, { status: 'FAILED', error: err.message || 'Local upload failed' })
      }
    }

    reader.readAsDataURL(file)
  }

  const uploadWithCloudinary = async (file: File, taskId: string) => {
    updateTask(taskId, { status: 'UPLOADING', progress: 0 })
    try {
      const signatureResponse = await fetch('/api/uploads/cloudinary/signature', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authHeader() }, body: JSON.stringify({ folder: 'nexus/default' }) })
      const signatureData = await signatureResponse.json()
      if (!signatureResponse.ok || signatureData.error) {
        throw new Error(signatureData.error || 'Cloudinary signature failed')
      }

      const form = new FormData()
      form.append('file', file)
      form.append('api_key', signatureData.api_key)
      form.append('timestamp', String(signatureData.timestamp))
      form.append('signature', signatureData.signature)
      form.append('folder', signatureData.folder)
      form.append('resource_type', file.type.startsWith('video') ? 'video' : 'auto')

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            updateTask(taskId, { progress: Math.round((e.loaded / e.total) * 100) })
          }
        }

        xhr.onload = async () => {
          try {
            const response = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300 && response.secure_url) {
              const notifyRes = await fetch('/api/uploads/cloudinary/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
                body: JSON.stringify({
                  fileName: response.original_filename || response.public_id,
                  mimeType: file.type || (response.resource_type === 'video' ? `video/${response.format}` : `image/${response.format}`),
                  secureUrl: response.secure_url,
                  publicId: response.public_id,
                  bytes: response.bytes,
                  resourceType: response.resource_type,
                  workspaceId: '',
                }),
              })
              const registered = await notifyRes.json()
              if (!notifyRes.ok || registered.error) {
                reject(new Error(registered.error || 'Failed to register media'))
                return
              }
              setMedia((prev) => [registered.media, ...prev])
              updateTask(taskId, { status: 'SUCCESS', progress: 100 })
              resolve()
            } else {
              reject(new Error(response.error?.message || 'Cloudinary upload failed'))
            }
          } catch (error) {
            reject(error)
          }
        }

        xhr.onerror = () => reject(new Error('Cloudinary upload network error'))
        xhr.send(form)
      })
    } catch (err: any) {
      console.error('Cloudinary upload failed', err)
      updateTask(taskId, { status: 'FAILED', error: err.message || 'Cloudinary upload failed' })
      await uploadToLocal(file, taskId)
    }
  }

  const handleUpload = async (file: File) => {
    const taskId = createUploadTask(file)

    if (canUseCloudinary) {
      await uploadWithCloudinary(file, taskId)
    } else {
      await uploadToLocal(file, taskId)
    }
  }

  const handleRetry = async (task: UploadTask) => {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = task.mimeType
    fileInput.onchange = async () => {
      if (fileInput.files?.[0]) {
        await handleUpload(fileInput.files[0])
        setUploadTasks((tasks) => tasks.filter((item) => item.id !== task.id))
      }
    }
    fileInput.click()
  }

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer?.files && e.dataTransfer.files.length) {
        handleUpload(e.dataTransfer.files[0])
      }
    }
    const onDragOver = (e: DragEvent) => e.preventDefault()
    el.addEventListener('drop', onDrop as any)
    el.addEventListener('dragover', onDragOver as any)
    return () => {
      el.removeEventListener('drop', onDrop as any)
      el.removeEventListener('dragover', onDragOver as any)
    }
  }, [dropRef.current, canUseCloudinary])

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center">Loading...</div>
  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="bg-dark-secondary border border-dark-tertiary rounded-lg p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">Media Library</h1>
              <p className="text-gray-400 mt-1">Upload and manage your images and videos.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search media"
                className="rounded border border-dark-tertiary bg-dark px-3 py-2 text-sm text-white"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded border border-dark-tertiary bg-dark px-3 py-2 text-sm text-white"
              >
                <option value="ALL">All</option>
                <option value="IMAGE">Images</option>
                <option value="VIDEO">Videos</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Upload</label>
            <div ref={dropRef} className="border-2 border-dashed border-dark-tertiary rounded-md p-6 text-center transition hover:border-accent">
              <input
                id="file-input"
                type="file"
                className="hidden"
                onChange={(e) => e.target.files && handleUpload(e.target.files[0])}
              />
              <label htmlFor="file-input" className="cursor-pointer text-sm text-accent">Click to select a file</label>
              <div className="text-sm text-gray-400 mt-2">Or drag & drop files here</div>
              {!canUseCloudinary && <div className="text-xs text-yellow-300 mt-2">Cloudinary unavailable, uploading locally.</div>}
            </div>
          </div>

          {uploadTasks.length > 0 && (
            <div className="mb-6 space-y-3">
              {uploadTasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-dark-tertiary bg-dark p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm truncate">{task.fileName}</div>
                      <div className="text-xs text-gray-400">{task.status}</div>
                    </div>
                    <div className="text-right">
                      {task.error && <div className="text-xs text-red-400">{task.error}</div>}
                      {task.status === 'FAILED' && (
                        <button onClick={() => handleRetry(task)} className="text-accent text-xs">
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-dark-tertiary overflow-hidden">
                    <div className="h-full bg-accent transition-all" style={{ width: `${task.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {errorMessage && <div className="mb-4 text-sm text-red-400">{errorMessage}</div>}

          {isLoadingMedia ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="bg-dark rounded-lg p-3 border border-dark-tertiary animate-pulse h-44" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {media.length === 0 ? (
                <div className="col-span-full rounded-lg bg-dark p-8 text-center text-gray-400">No media found.</div>
              ) : (
                media.map((m) => (
                  <div key={m.id} className="bg-dark rounded-lg overflow-hidden border border-dark-tertiary">
                    {m.type === 'VIDEO' ? (
                      <video
                        className="w-full h-40 object-cover"
                        controls
                        muted
                        preload="metadata"
                        poster={m.cloudinaryId ? `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${m.cloudinaryId}.jpg` : undefined}
                      >
                        <source src={m.url} type={m.mimeType} />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <img src={m.url} alt={m.fileName} className="w-full h-40 object-cover" />
                    )}
                    <div className="p-3">
                      <div className="font-semibold text-sm truncate">{m.fileName}</div>
                      <div className="text-xs text-gray-400 mt-1">{m.mimeType}</div>
                      <a href={m.url} target="_blank" rel="noreferrer" className="text-accent text-sm mt-2 inline-block">
                        Open
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
            <div>Page {page} of {totalPages}</div>
            <div className="flex gap-3">
              <button disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} className="rounded border border-dark-tertiary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">
                Previous
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} className="rounded border border-dark-tertiary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}