'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import AppShell from '@/components/AppShell'

export default function SettingsPage() {
  const router = useRouter()
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

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

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

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>
  if (!isAuthenticated) return null

  const email = user?.email || ''
  const provider = user?.app_metadata?.provider || 'email'
  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
  const plan = 'FREE'

  return (
    <AppShell>

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-1">Account Settings</h1>
          <p className="text-gray-400">Manage your profile and account preferences.</p>
        </div>

        {/* Account Overview */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold text-accent">
              {(displayName || email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xl font-bold">{displayName || 'User'}</div>
              <div className="text-gray-400 text-sm">{email}</div>
              <div className="flex gap-3 mt-2">
                <span className="text-xs bg-dark-tertiary px-3 py-1 rounded-full text-gray-400">
                  {provider === 'google' ? '🔵 Google Account' : '📧 Email Account'}
                </span>
                <span className="text-xs bg-accent/10 border border-accent/30 text-accent px-3 py-1 rounded-full">
                  {plan} Plan
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-dark-tertiary">
            <div>
              <div className="text-xs text-gray-500 mb-1">Member since</div>
              <div className="text-sm font-semibold">{createdAt}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">User ID</div>
              <div className="text-xs font-mono text-gray-400 truncate">{user?.id}</div>
            </div>
          </div>
        </div>

        {/* Profile / Display Name */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-1">Profile</h2>
          <p className="text-gray-400 text-sm mb-6">Update your display name.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-3 bg-dark/50 border border-dark-tertiary rounded-xl text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed from here.</p>
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
            <p className="text-gray-400 text-sm mb-6">Choose a strong password of at least 8 characters.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 characters)"
                  className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
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
                className="px-6 py-3 bg-dark-tertiary hover:bg-dark-tertiary/70 font-bold rounded-xl transition disabled:opacity-50 text-sm"
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
              <p className="text-gray-400 text-sm">You're currently on the <span className="text-accent font-semibold">Free plan</span>.</p>
            </div>
            <Link
              href="/billing"
              className="px-5 py-2 bg-accent text-dark font-bold rounded-lg hover:bg-accent-light transition text-sm"
            >
              Upgrade Plan
            </Link>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-dark-secondary border border-red-500/20 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1 text-red-400">Danger Zone</h2>
          <p className="text-gray-400 text-sm mb-6">Actions here are permanent and cannot be undone.</p>

          <div className="flex items-center justify-between p-4 bg-dark border border-dark-tertiary rounded-xl">
            <div>
              <div className="font-semibold text-sm">Sign out of all devices</div>
              <div className="text-xs text-gray-400 mt-1">Log out of your NEXUS account everywhere.</div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-dark-tertiary hover:bg-red-500/20 hover:border-red-500/50 border border-dark-tertiary text-sm font-semibold rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>

      </div>
    </AppShell>
  )
}