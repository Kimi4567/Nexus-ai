'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import AppShell from '@/components/AppShell'

interface SocialAccount {
  id: string
  platform: string
  status: string
  accountId: string
  accountName: string
  pages: Array<{ id: string; name: string; igAccountId: string | null }>
  pictureUrl: string | null
  connectedAt: string
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, loading, authHeader } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState('')
  const [nameError, setNameError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Social accounts
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [socialLoading, setSocialLoading] = useState(false)
  const [socialConnecting, setSocialConnecting] = useState(false)
  const [socialMessage, setSocialMessage] = useState('')
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  // Handle OAuth callback messages
  useEffect(() => {
    const social = searchParams.get('social')
    const platform = searchParams.get('platform')
    if (social === 'connected') {
      setSocialMessage(`✓ ${platform === 'meta' ? 'Meta (Facebook/Instagram)' : platform} connected successfully!`)
      setTimeout(() => setSocialMessage(''), 4000)
    } else if (social === 'denied') {
      setSocialMessage('Connection was cancelled.')
      setTimeout(() => setSocialMessage(''), 3000)
    } else if (social === 'error') {
      const msg = searchParams.get('msg') || 'unknown'
      setSocialMessage(`Connection failed: ${msg}`)
      setTimeout(() => setSocialMessage(''), 10000)
    }
  }, [searchParams])

  const fetchSocialAccounts = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setSocialLoading(true)
    try {
      const res = await fetch('/api/social/accounts', { headers: { Authorization: token } })
      const data = await res.json()
      setSocialAccounts(data.accounts || [])
    } catch {
      setSocialAccounts([])
    } finally {
      setSocialLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    if (isAuthenticated) fetchSocialAccounts()
  }, [isAuthenticated, fetchSocialAccounts])

  const handleConnectMeta = async () => {
    const token = authHeader()
    if (!token) return
    setSocialConnecting(true)
    try {
      const res = await fetch('/api/social/connect/meta', { headers: { Authorization: token } })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setSocialMessage(data.error || 'Failed to start connection')
      }
    } catch {
      setSocialMessage('Connection failed. Check Meta App configuration.')
    } finally {
      setSocialConnecting(false)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    const token = authHeader()
    if (!token) return
    setDisconnecting(integrationId)
    try {
      await fetch('/api/social/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ integrationId }),
      })
      setSocialAccounts(prev => prev.filter(a => a.id !== integrationId))
    } catch {
      setSocialMessage('Failed to disconnect.')
    } finally {
      setDisconnecting(null)
    }
  }

  useEffect(() => {
    if (user) {
      setDisplayName(user?.user_metadata?.name || user?.email?.split('@')[0] || '')
    }
  }, [user])

  const handleSaveName = async () => {
    if (!displayName.trim()) return
    setSavingName(true)
    setNameError('')
    setNameSuccess('')
    try {
      const { error } = await supabase.auth.updateUser({ data: { name: displayName } })
      if (error) throw error
      setNameSuccess('Name updated successfully!')
      setTimeout(() => setNameSuccess(''), 3000)
    } catch (err: any) {
      setNameError(err.message || 'Failed to update name')
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  const email = user?.email || ''
  const provider = user?.app_metadata?.provider || 'email'
  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
  const plan = 'FREE'

  return (
    <AppShell>

      <div className="max-w-3xl mx-auto px-6 py-12 page-enter">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-1">Account Settings</h1>
          <p className="text-t2">Manage your profile and account preferences.</p>
        </div>

        {/* Account Overview */}
        <div className="surface-card rounded-card p-6 mb-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold text-accent">
              {(displayName || email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xl font-bold">{displayName || 'User'}</div>
              <div className="text-t2 text-sm">{email}</div>
              <div className="flex gap-3 mt-2">
                <span className="text-xs bg-s3 px-3 py-1 rounded-full text-t3">
                  {provider === 'google' ? '🔵 Google Account' : '📧 Email Account'}
                </span>
                <span className="text-xs bg-accent/10 border border-accent/30 text-accent px-3 py-1 rounded-full">
                  {plan} Plan
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <div className="text-xs text-t3 mb-1">Member since</div>
              <div className="text-sm font-semibold">{createdAt}</div>
            </div>
            <div>
              <div className="text-xs text-t3 mb-1">User ID</div>
              <div className="text-xs font-mono text-t2 truncate">{user?.id}</div>
            </div>
          </div>
        </div>

        {/* Profile / Display Name */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-1">Profile</h2>
          <p className="text-t2 text-sm mb-6">Update your display name.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 bg-s0 border border-s4 rounded-xl text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-3 bg-s0/50 border border-s4 rounded-xl text-t3 cursor-not-allowed"
              />
              <p className="text-xs text-t3 mt-1">Email cannot be changed from here.</p>
            </div>

            {nameSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3 text-sm">
                ✓ {nameSuccess}
              </div>
            )}
            {nameError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
                {nameError}
              </div>
            )}

            <button
              onClick={handleSaveName}
              disabled={savingName || !displayName.trim()}
              className="px-6 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition disabled:opacity-50 text-sm"
            >
              {savingName ? 'Saving...' : 'Save Name'}
            </button>
          </div>
        </div>

        {/* Change Password */}
        {provider !== 'google' && (
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold mb-1">Change Password</h2>
            <p className="text-t2 text-sm mb-6">Choose a strong password of at least 8 characters.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 characters)"
                  className="w-full px-4 py-3 bg-s0 border border-s4 rounded-xl text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-3 bg-s0 border border-s4 rounded-xl text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition"
                />
              </div>

              {passwordSuccess && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3 text-sm">
                  ✓ {passwordSuccess}
                </div>
              )}
              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
                  {passwordError}
                </div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="px-6 py-3 bg-s3 hover:bg-s4 font-bold rounded-xl transition disabled:opacity-50 text-sm text-t1"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        )}

        {/* Plan */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold mb-1">Subscription</h2>
              <p className="text-t2 text-sm">You're currently on the <span className="text-accent font-semibold">Free plan</span>.</p>
            </div>
            <Link
              href="/billing"
              className="px-5 py-2 bg-accent text-dark font-bold rounded-lg hover:bg-accent-light transition text-sm"
            >
              Upgrade Plan
            </Link>
          </div>
        </div>

        {/* Connected Accounts */}
        <div className="surface-card rounded-card p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">Connected Accounts</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-semibold uppercase tracking-wider">Beta</span>
          </div>
          <p className="text-t2 text-sm mb-6">Connect your social accounts to publish campaigns directly from Nexus.</p>

          {/* Social message */}
          {socialMessage && (
            <div className={`rounded-lg p-3 text-sm mb-4 ${
              socialMessage.startsWith('✓')
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {socialMessage}
            </div>
          )}

          {/* Meta */}
          {(() => {
            const metaAccount = socialAccounts.find(a => a.platform === 'META')
            return (
              <div className="flex items-center justify-between p-4 bg-s0 border border-s4 rounded-xl mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: 'rgba(24,119,242,0.12)', border: '1px solid rgba(24,119,242,0.2)' }}>
                    📘
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Meta (Facebook + Instagram)</div>
                    {metaAccount ? (
                      <div className="text-xs text-t3 mt-0.5">
                        Connected as <span className="text-t2 font-medium">{metaAccount.accountName}</span>
                        {' · '}{metaAccount.pages.length} page{metaAccount.pages.length !== 1 ? 's' : ''}
                      </div>
                    ) : (
                      <div className="text-xs text-t3 mt-0.5">Not connected</div>
                    )}
                  </div>
                </div>
                {metaAccount ? (
                  <button
                    onClick={() => handleDisconnect(metaAccount.id)}
                    disabled={disconnecting === metaAccount.id}
                    className="px-4 py-2 text-sm font-semibold rounded-lg transition text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30"
                  >
                    {disconnecting === metaAccount.id ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    onClick={handleConnectMeta}
                    disabled={socialConnecting || !process.env.NEXT_PUBLIC_META_APP_ID}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-accent text-dark hover:bg-accent-light transition disabled:opacity-50"
                  >
                    {socialConnecting ? 'Connecting…' : 'Connect'}
                  </button>
                )}
              </div>
            )
          })()}

          {/* Pages list if connected */}
          {socialAccounts.find(a => a.platform === 'META')?.pages.length ? (
            <div className="mt-2 px-1">
              <div className="text-[11px] text-t3 mb-2 px-1 font-semibold uppercase tracking-wider">Connected Pages</div>
              <div className="space-y-1">
                {socialAccounts.find(a => a.platform === 'META')!.pages.map(page => (
                  <div key={page.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-s1 border border-s3">
                    <span className="text-sm">📄</span>
                    <span className="text-sm text-t2">{page.name}</span>
                    {page.igAccountId && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded-md ml-auto">IG linked</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* TikTok — Coming Soon */}
          <div className="flex items-center justify-between p-4 bg-s0 border border-s4 rounded-xl opacity-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                🎵
              </div>
              <div>
                <div className="font-semibold text-sm">TikTok for Business</div>
                <div className="text-xs text-t3 mt-0.5">Coming soon</div>
              </div>
            </div>
            <span className="text-xs text-t3 border border-s4 px-3 py-1.5 rounded-lg">Soon</span>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="surface-card rounded-card p-6" style={{ borderColor: 'rgba(239,68,68,0.18)' }}>
          <h2 className="text-lg font-bold mb-1 text-red-400">Danger Zone</h2>
          <p className="text-t2 text-sm mb-6">Actions here are permanent and cannot be undone.</p>

          <div className="flex items-center justify-between p-4 bg-s0 border border-s4 rounded-xl">
            <div>
              <div className="font-semibold text-sm">Sign out of all devices</div>
              <div className="text-xs text-t3 mt-1">Log out of your NEXUS account everywhere.</div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-s3 hover:bg-red-500/15 border border-s4 hover:border-red-500/40 text-sm font-semibold rounded-lg transition text-t1"
            >
              Sign Out
            </button>
          </div>
        </div>

      </div>
    </AppShell>
  )
}