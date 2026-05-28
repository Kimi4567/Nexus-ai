'use client'

/* ═══════════════════════════════════════════════════════════════
   StarField — Lightweight CSS-only star background
   Uses CSS gradients instead of DOM elements for GPU performance
   ═══════════════════════════════════════════════════════════════ */

interface StarFieldProps {
  density?: 'low' | 'medium' | 'high'
  color?: string
  className?: string
}

export default function StarField({ density = 'medium', color = '255,255,255', className = '' }: StarFieldProps) {
  const opacities = {
    low: '0.02, 0.04, 0.06',
    medium: '0.015, 0.03, 0.05, 0.08',
    high: '0.01, 0.02, 0.04, 0.06, 0.08, 0.1',
  }

  const sizes = {
    low: '1px, 2px',
    medium: '1px, 1.5px, 2px',
    high: '1px, 1px, 1.5px, 2px, 2.5px',
  }

  return (
    <div
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{
        zIndex: 0,
        background: `
          radial-gradient(circle at 20% 30%, rgba(${color},${opacities[density].split(',')[0]}) 1px, transparent 1px),
          radial-gradient(circle at 80% 70%, rgba(${color},${opacities[density].split(',')[1]}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 40% 80%, rgba(${color},${opacities[density].split(',')[2] || '0.04'}) 2px, transparent 2px),
          radial-gradient(circle at 60% 20%, rgba(${color},${opacities[density].split(',')[3] || '0.03'}) 1px, transparent 1px),
          radial-gradient(circle at 10% 60%, rgba(${color},${opacities[density].split(',')[4] || '0.02'}) 2px, transparent 2px),
          radial-gradient(circle at 90% 40%, rgba(${color},${opacities[density].split(',')[5] || '0.02'}) 1.5px, transparent 1.5px),
          radial-gradient(circle at 50% 50%, rgba(${color},0.01) 1px, transparent 1px)
        `,
        backgroundSize: '550px 550px, 430px 430px, 350px 350px, 280px 280px, 520px 520px, 380px 380px, 600px 600px',
        animation: 'starShift 120s linear infinite',
      }}
    >
      <style jsx>{`
        @keyframes starShift {
          0% { background-position: 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0; }
          100% { background-position: 550px 550px, -430px 430px, 350px -350px, -280px -280px, 520px -520px, -380px 380px, 600px 600px; }
        }
      `}</style>
    </div>
  )
}
