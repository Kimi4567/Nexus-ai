'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function BootstrapPage() {
  const [log, setLog] = useState<string[]>(['🔄 Starting diagnostic...'])
  const [done, setDone] = useState(false)

  function add(msg: string) {
    setLog(prev => [...prev, msg])
  }

  useEffect(() => {
    async function run() {
      // Step 1: get session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        add('❌ Not logged in. Go to /auth/login first.')
        setDone(true)
        return
      }
      add(`✅ Logged in. Auth UUID: ${session.user.id}`)
      add(`📧 Auth email: ${session.user.email}`)

      // Step 2: diagnose
      add('🔍 Checking DB state...')
      const diagRes = await fetch('/api/seed-owner', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const diag = await diagRes.json()

      if (diag.error) {
        add(`❌ Diagnostic error: ${diag.error}`)
        if (diag.error === 'Not authenticated') {
          add('→ Session token not accepted by API. Try logging out and back in.')
        }
        setDone(true)
        return
      }

      add(`🔑 Auth UUID:   ${diag.authUUID}`)
      add(`📧 Auth email:  ${diag.authEmail}`)
      add(`🗄️  DB row by UUID: ${JSON.stringify(diag.dbRowByUUID)}`)
      add(`📋 All rows by email: ${JSON.stringify(diag.allRowsByEmail)}`)
      if (diag.prismaError) add(`💥 Prisma error: ${diag.prismaError}`)

      // Step 3: fix
      add('')
      add('🔧 Applying fix (upsert ADMIN + 500 credits)...')
      const fixRes = await fetch('/api/seed-owner', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const fix = await fixRes.json()

      if (fix.ok) {
        add(`✅ FIX APPLIED!`)
        add(`   id:        ${fix.id}`)
        add(`   email:     ${fix.email}`)
        add(`   role:      ${fix.role}`)
        add(`   aiCredits: ${fix.aiCredits}`)
        add('')
        add('🎉 Done! Now:')
        add('1. Go to nexus-grow.com/dashboard')
        add('2. Press Cmd+Shift+R (hard refresh)')
        add('3. Credits should show 500 and /admin should open')
      } else {
        add(`❌ Fix failed: ${fix.error}`)
      }

      setDone(true)
    }

    run()
  }, [])

  return (
    <div style={{
      padding: '40px',
      fontFamily: 'monospace',
      fontSize: '14px',
      background: '#0a0a0a',
      color: '#00ff88',
      minHeight: '100vh',
      lineHeight: '1.8',
    }}>
      <h1 style={{ color: '#ffffff', marginBottom: '24px' }}>NEXUS Bootstrap</h1>
      {log.map((line, i) => (
        <div key={i}>{line || ' '}</div>
      ))}
      {done && (
        <div style={{ marginTop: '32px' }}>
          <a
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#6c47ff',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontFamily: 'sans-serif',
              fontWeight: 'bold',
            }}
          >
            → Go to Dashboard
          </a>
        </div>
      )}
    </div>
  )
}
