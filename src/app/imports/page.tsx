'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'

export default function ImportsPage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const router = useRouter()
  const [media, setMedia] = useState<any[]>([])

  useEffect(() => {
    if (!loading && !isAuthenticated) { router.push('/auth/login'); return }
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return
    ;(async () => {
      try {
        const token = authHeader()
        const res = await fetch('/api/media', {
          headers: token ? { Authorization: token } : {},
        })
        const data = await res.json()
        if (data.media) setMedia(data.media)
      } catch (err) {
        // ignore
      }
    })()
  }, [isAuthenticated, authHeader])

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center">Loading...</div>
  if (!isAuthenticated) return null

  const mockAssets = media.length ? media : [
    { id: 'a1', name: 'Product Hero Video', type: 'video', size: '12MB' },
    { id: 'a2', name: 'Logo Pack', type: 'image', size: '2.3MB' },
    { id: 'a3', name: 'Caption Library', type: 'text', size: '120KB' },
  ]

  return (
    <AppShell>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-dark-secondary border border-dark-tertiary rounded-lg p-8">
          <h1 className="text-3xl font-bold mb-4">Imports</h1>
          <p className="text-gray-400 mb-6">Upload or import assets from third-party sources. For now, use the mock assets below to preview functionality.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockAssets.map(asset => (
              <div key={asset.id} className="bg-dark rounded-lg border border-dark-tertiary p-4">
                <div className="font-semibold">{asset.name}</div>
                <div className="text-sm text-gray-400">{asset.type} • {asset.size}</div>
                <div className="mt-4 flex gap-2">
                  <button className="px-3 py-2 bg-accent text-dark rounded-lg">Use</button>
                  <button className="px-3 py-2 bg-dark-tertiary rounded-lg">Preview</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <label className="block text-sm font-medium mb-2">Upload New Asset (placeholder)</label>
            <div className="flex gap-2">
              <input type="file" className="bg-dark-tertiary rounded-md p-2" />
              <button className="px-4 py-2 bg-accent text-dark rounded-md">Upload</button>
            </div>
          </div>

          <div className="mt-8">
            <Link href="/dashboard">
              <button className="px-4 py-2 bg-dark-tertiary rounded-md">Back to Dashboard</button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}