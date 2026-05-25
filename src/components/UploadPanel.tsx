'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface MediaRecord {
  id: string
  fileName: string
  mimeType: string
  type: string
  url: string
  cloudinaryId?: string
}

type UploadStatus = 'PENDING' | 'UPLOADING' | 'SUCCESS' | 'FAILED'

interface UploadTask {
  id: string
  fileName: string
  mimeType: string
  status: UploadStatus
  progress: number
  error?: string
  media?: MediaRecord
  createdAt: string
}

interface UploadPanelProps {
  workspaceId?: string
  projectId?: string
  campaignId?: string
  initialMedia?: MediaRecord[]
  onMediaAdded?: (media: MediaRecord) => void
}

const STATUS_LABELS: Record<UploadStatus, string> = {
  PENDING: 'Pending',
  UPLOADING: 'Uploading',
  SUCCESS: 'Uploaded',
  FAILED: 'Failed',
}

function getStorageKey(projectId?: string, campaignId?: string) {
  if (campaignId) return `nexus_upload_tasks_campaign_${campaignId}`
  if (projectId) return `nexus_upload_tasks_project_${projectId}`
  return 'nexus_upload_tasks_global'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function UploadPanel({ workspaceId, projectId, campaignId, initialMedia = [], onMediaAdded }: UploadPanelProps) {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([])
  const [attachedMedia, setAttachedMedia] = useState<MediaRecord[]>(initialMedia)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [panelReady, setPanelReady] = useState(true)
  const pendingFiles = useRef<Record<string, File>>({})
  const storageKey = useMemo(() => getStorageKey(projectId, campaignId), [projectId, campaignId])

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    if (stored) {
      try {
        const saved = JSON.parse(stored) as UploadTask[]
        setUploadTasks(saved)
      } catch {
        // ignore invalid storage
      }
    }
  }, [storageKey])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(uploadTasks))
  }, [storageKey, uploadTasks])

  useEffect(() => {
    setAttachedMedia(initialMedia)
  }, [initialMedia])

  const updateTask = (id: string, changes: Partial<UploadTask>) => {
    setUploadTasks((tasks) => tasks.map((task) => (task.id === id ? { ...task, ...changes } : task)))
  }

  const addTask = (file: File) => {
    const id = `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`
    const task: UploadTask = {
      id,
      fileName: file.name,
      mimeType: file.type,
      status: 'PENDING',
      progress: 0,
      createdAt: new Date().toISOString(),
    }
    pendingFiles.current[id] = file
    setUploadTasks((tasks) => [task, ...tasks])
    return id
  }

  const createUploadSession = async (file: File) => {
    const response = await fetch('/api/uploads/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        projectId,
        campaignId,
        resourceType: file.type.startsWith('video') ? 'video' : 'auto',
        fileName: file.name,
      }),
    })

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.error || payload.errorCode || 'Unable to create upload session')
    }
    return payload.sessionToken as string
  }

  const getCloudinarySignature = async (sessionToken: string) => {
    const response = await fetch('/api/uploads/cloudinary/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken }),
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.error || payload.errorCode || 'Unable to sign upload')
    }
    return payload
  }

  const notifyCloudinaryUpload = async (taskId: string, responseData: any, sessionToken: string) => {
    const response = await fetch('/api/uploads/cloudinary/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: responseData.original_filename || responseData.public_id,
        mimeType: responseData.resource_type === 'video' ? `video/${responseData.format}` : `image/${responseData.format}`,
        secureUrl: responseData.secure_url,
        publicId: responseData.public_id,
        bytes: responseData.bytes,
        resourceType: responseData.resource_type,
        sessionToken,
      }),
    })

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.error || payload.errorCode || 'Upload registration failed')
    }
    return payload.media as MediaRecord
  }

  const uploadFile = async (taskId: string, attempt = 1) => {
    const file = pendingFiles.current[taskId]
    if (!file) {
      updateTask(taskId, { status: 'FAILED', error: 'Upload file missing from session' })
      return
    }

    try {
      setErrorMessage(null)
      updateTask(taskId, { status: 'UPLOADING', progress: 0 })
      setSessionLoading(true)

      const sessionToken = await createUploadSession(file)
      const signatureData = await getCloudinarySignature(sessionToken)

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/auto/upload`)

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            updateTask(taskId, { progress: Math.round((event.loaded / event.total) * 100) })
          }
        }

        xhr.onload = async () => {
          try {
            const response = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300 && response.secure_url) {
              const media = await notifyCloudinaryUpload(taskId, response, sessionToken)
              setAttachedMedia((existing) => [media, ...existing])
              if (onMediaAdded) onMediaAdded(media)
              updateTask(taskId, { status: 'SUCCESS', progress: 100, media })
              resolve()
            } else {
              const message = response.error?.message || 'Cloudinary upload failed'
              reject(new Error(message))
            }
          } catch (error) {
            reject(error)
          }
        }

        xhr.onerror = () => reject(new Error('Cloudinary upload network error'))
        const form = new FormData()
        form.append('file', file)
        form.append('api_key', String(signatureData.api_key))
        form.append('timestamp', String(signatureData.timestamp))
        form.append('signature', String(signatureData.signature))
        form.append('folder', String(signatureData.folder))
        form.append('resource_type', String(signatureData.resource_type))
        xhr.send(form)
      })
    } catch (error: any) {
      const message = error?.message || 'Upload failed'
      if (message.includes('SESSION_EXPIRED') || message.includes('INVALID_SESSION')) {
        if (attempt < 2) {
          return uploadFile(taskId, attempt + 1)
        }
      }
      updateTask(taskId, { status: 'FAILED', error: message, progress: 0 })
      setErrorMessage(message)
    } finally {
      setSessionLoading(false)
    }
  }

  const handleFileDrop = (file: File) => {
    const taskId = addTask(file)
    uploadFile(taskId)
  }

  const handleRetry = async (taskId: string) => {
    const file = pendingFiles.current[taskId]
    if (!file) {
      setErrorMessage('Retry failed: original file is unavailable. Please select it again.')
      return
    }
    uploadFile(taskId)
  }

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      const droppedFile = event.dataTransfer?.files?.[0]
      if (droppedFile) handleFileDrop(droppedFile)
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="bg-dark rounded-3xl border border-dark-tertiary p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Upload assets</h2>
            <p className="text-sm text-gray-400">
              Select files to attach to this campaign. Upload sessions are created automatically and refreshed on expiration.
            </p>
          </div>
          <div className="text-sm text-gray-400">
            {sessionLoading ? 'Refreshing upload session…' : campaignId ? 'Attached to draft campaign' : 'Workspace-level upload'}
          </div>
        </div>

        <label className="group block cursor-pointer rounded-3xl border border-dashed border-dark-tertiary bg-dark-tertiary/60 p-8 text-center transition hover:border-accent hover:bg-dark-secondary">
          <input
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFileDrop(file)
            }}
          />
          <div className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full border border-accent/30 bg-accent/5 text-3xl">
            ⬆️
          </div>
          <p className="text-sm text-gray-300">Drop files here, or click to select</p>
          <p className="text-xs text-gray-500 mt-2">Images and videos supported. Upload session is created for every upload.</p>
        </label>

        {errorMessage && <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-100">{errorMessage}</div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="bg-dark rounded-3xl border border-dark-tertiary p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Upload queue</h3>
                <p className="text-sm text-gray-400">Track state, progress and retry failed uploads.</p>
              </div>
              <div className="text-xs text-gray-500">{uploadTasks.length} item(s)</div>
            </div>

            <div className="space-y-3">
              {uploadTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-dark-tertiary bg-dark-secondary p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="font-medium">{task.fileName}</div>
                      <div className="text-xs text-gray-500">{task.mimeType} • {STATUS_LABELS[task.status]}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(task.id)}
                          className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-dark"
                        >
                          Retry
                        </button>
                      )}
                      {task.status === 'SUCCESS' && task.media && (
                        <span className="text-xs text-emerald-300">Attached</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-dark-tertiary">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${task.progress}%` }} />
                  </div>

                  {task.error && <div className="mt-3 text-sm text-red-300">{task.error}</div>}
                </div>
              ))}
              {uploadTasks.length === 0 && <div className="text-sm text-gray-400">No uploads yet. Start by selecting a file.</div>}
            </div>
          </div>

          <div className="bg-dark rounded-3xl border border-dark-tertiary p-6">
            <h3 className="text-lg font-semibold mb-3">Media attached</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {attachedMedia.length > 0 ? (
                attachedMedia.map((media) => (
                  <a
                    key={media.id}
                    href={media.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-3xl border border-dark-tertiary bg-dark-secondary p-4 transition hover:border-accent"
                  >
                    <div className="text-sm text-gray-400 truncate">{media.fileName}</div>
                    <div className="mt-2 text-sm text-white">{media.type.toUpperCase()}</div>
                    <div className="mt-1 text-xs text-gray-500">{media.mimeType}</div>
                  </a>
                ))
              ) : (
                <div className="text-sm text-gray-400">No media attached yet. Files uploaded here will be linked to the active campaign.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-dark rounded-3xl border border-dark-tertiary p-6">
            <h3 className="text-lg font-semibold mb-3">Upload guidance</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>• Upload sessions are short-lived and refresh automatically.</li>
              <li>• Failed uploads can be retried without losing any attached media.</li>
              <li>• Uploaded media is persisted with your draft campaign.</li>
              <li>• Files are tagged to workspace, project and campaign for future AI analysis.</li>
            </ul>
          </div>

          <div className="bg-dark rounded-3xl border border-dark-tertiary p-6">
            <h3 className="text-lg font-semibold mb-3">Tips</h3>
            <p className="text-sm text-gray-400">Use upload sessions for sensitive workflow state. If a session expires while uploading, retry and the panel will obtain a fresh session token.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
