import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'NEXUS AI — Your AI Marketing Department'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0E27',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            left: '-100px',
            width: '800px',
            height: '800px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-200px',
            right: '-100px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,191,166,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <span style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', letterSpacing: '-1px' }}>
            NEXUS
          </span>
          <span
            style={{
              background: '#8B5CF6',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
            }}
          >
            AI
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: '64px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.1,
            letterSpacing: '-2px',
            marginBottom: '24px',
            maxWidth: '800px',
          }}
        >
          <div style={{ display: 'flex' }}>
            Your AI <span style={{ color: '#8B5CF6' }}>Marketing</span>
          </div>
          <div style={{ display: 'flex' }}>Department</div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '24px',
            color: '#8892B0',
            maxWidth: '700px',
            lineHeight: 1.5,
            marginBottom: '48px',
          }}
        >
          Strategy · Content · Campaigns · Analytics — in one platform with full human control.
        </div>

        {/* Agent pills */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { name: 'STRATEGIST', color: '#8B5CF6' },
            { name: 'NEX', color: '#10B981' },
            { name: 'VEX', color: '#FF6B35' },
            { name: 'PULSE', color: '#00D4FF' },
            { name: 'SENTINEL', color: '#FFD700' },
          ].map((agent) => (
            <div
              key={agent.name}
              style={{
                background: `${agent.color}20`,
                border: `1px solid ${agent.color}40`,
                color: agent.color,
                fontSize: '13px',
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: '999px',
                letterSpacing: '1px',
              }}
            >
              {agent.name}
            </div>
          ))}
        </div>

        {/* Bottom right domain */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '80px',
            fontSize: '18px',
            color: '#4A5568',
            fontWeight: 500,
          }}
        >
          nexus-grow.com
        </div>
      </div>
    ),
    { ...size }
  )
}
