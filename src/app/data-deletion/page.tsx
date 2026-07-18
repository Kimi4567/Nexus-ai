'use client'

/**
 * /data-deletion — Meta Data Deletion Status Page
 *
 * Public page required by Meta Platform Policy.
 * Users and Meta's reviewers can check the status of a data deletion request
 * by visiting: https://nexus-grow.com/data-deletion?id=<confirmation_code>
 *
 * This page is linked in the Privacy Policy and registered in the Meta App Dashboard
 * as the "Data Deletion Instructions URL".
 */

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'

type DeletionStatus = {
  status: 'instructions' | 'pending' | 'completed' | 'not_found' | 'loading' | 'error'
  requestedAt?: string
  completedAt?: string
  confirmationCode?: string
}

function DataDeletionContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [state, setState] = useState<DeletionStatus>({ status: 'loading' })

  useEffect(() => {
    if (!id) {
      setState({ status: 'instructions' })
      return
    }

    fetch(`/api/social/data-deletion-status?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error || !data.status) {
          setState({ status: 'not_found' })
        } else {
          setState({
            status: data.status,
            requestedAt: data.requestedAt,
            completedAt: data.completedAt,
            confirmationCode: data.confirmationCode,
          })
        }
      })
      .catch(() => setState({ status: 'error' }))
  }, [id])

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">

        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold text-white">
              NEXUS<span className="text-[#7B5EA7]">.</span>AI
            </span>
          </Link>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-xl font-semibold text-white mb-2">
            Data Deletion Request
          </h1>
          <p className="text-sm text-white/50 mb-8">
            {id ? 'Status of your Facebook data deletion request' : 'Delete connected-platform data or request deletion of your NEXUS account data'}
          </p>

          {state.status === 'instructions' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 p-4">
                <p className="text-sm font-semibold text-violet-200">For connected social or ad accounts</p>
                <p className="mt-2 text-xs leading-5 text-white/60">
                  Open Connections and disconnect the provider. NEXUS removes the stored integration record and its encrypted OAuth token; data retained by the provider remains subject to that provider&apos;s controls and policy.
                </p>
                <Link href="/connections" className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-bold text-black">
                  Open Connections
                </Link>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">For your NEXUS account and workspace data</p>
                <p className="mt-2 text-xs leading-5 text-white/60">
                  Email privacy@nexus-grow.com from the address on your account with the subject “Account deletion request”. We will verify ownership, explain any legally required retention, and confirm when the request is completed. Do not send passwords, access tokens, or payment-card details.
                </p>
                <a href="mailto:privacy@nexus-grow.com?subject=Account%20deletion%20request" className="mt-3 inline-flex rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white">
                  Email a deletion request
                </a>
              </div>
              <p className="text-xs leading-5 text-white/40">
                Meta callback requests include a confirmation code in this page URL. When a code is present, this page switches to the callback-status view automatically.
              </p>
            </div>
          )}

          {/* Status display */}
          {state.status === 'loading' && (
            <div className="flex items-center gap-3 text-white/60">
              <div className="w-5 h-5 border-2 border-white/20 border-t-[#7B5EA7] rounded-full animate-spin" />
              <span>Checking deletion status…</span>
            </div>
          )}

          {state.status === 'completed' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-green-400 font-medium text-sm">Deletion Completed</p>
                  <p className="text-white/50 text-xs mt-0.5">
                    Your Facebook data has been removed from our systems.
                  </p>
                </div>
              </div>
              {state.completedAt && (
                <p className="text-white/40 text-xs">
                  Completed on {new Date(state.completedAt).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              )}
            </div>
          )}

          {state.status === 'pending' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-yellow-400 font-medium text-sm">Deletion In Progress</p>
                  <p className="text-white/50 text-xs mt-0.5">
                    Your deletion request has been received and is being processed. This typically takes up to 30 days.
                  </p>
                </div>
              </div>
              {state.requestedAt && (
                <p className="text-white/40 text-xs">
                  Requested on {new Date(state.requestedAt).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              )}
            </div>
          )}

          {(state.status === 'not_found' || state.status === 'error') && id && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-red-400 font-medium text-sm">Request Not Found</p>
                <p className="text-white/50 text-xs mt-0.5">
                  {id
                    ? 'No deletion request found for this confirmation code.'
                    : 'Please provide a confirmation code in the URL (e.g., /data-deletion?id=your_code).'}
                </p>
              </div>
            </div>
          )}

          {/* Confirmation code */}
          {id && state.status !== 'loading' && state.status !== 'not_found' && state.status !== 'error' && (
            <div className="mt-6 p-3 bg-white/5 rounded-lg">
              <p className="text-white/40 text-xs mb-1">Confirmation Code</p>
              <code className="text-white/70 text-xs font-mono break-all">{id}</code>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-white/30 text-xs">
            Questions? Contact us at{' '}
            <a href="mailto:privacy@nexus-grow.com" className="text-[#7B5EA7] hover:underline">
              privacy@nexus-grow.com
            </a>
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/privacy" className="text-white/30 hover:text-white/50 text-xs transition-colors">
              Privacy Policy
            </Link>
            <span className="text-white/20">·</span>
            <Link href="/terms" className="text-white/30 hover:text-white/50 text-xs transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function DataDeletionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-[#7B5EA7] rounded-full animate-spin" />
      </div>
    }>
      <DataDeletionContent />
    </Suspense>
  )
}
