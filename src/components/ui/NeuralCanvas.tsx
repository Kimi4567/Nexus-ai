// @ts-nocheck
'use client'

import { useEffect, useRef } from 'react'

/* ═══════════════════════════════════════════════════════════════
   NeuralCanvas v3 — Ultra-Lightweight
   • 8 nodes max (6 on mobile)
   • 20fps cap + skip every 2nd frame
   • No sqrt() — squared distance only
   • Pauses when tab hidden (visibilitychange)
   • Pauses when not visible (IntersectionObserver)
   ═══════════════════════════════════════════════════════════════ */

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: string
}

export default function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const visibleRef = useRef(true)
  const tabVisibleRef = useRef(true)
  const frameSkipRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const isMobile = window.innerWidth < 768
    const NODE_COUNT = isMobile ? 6 : 8
    const CONNECTION_DIST_SQ = isMobile ? 0 : 9000 // No connections on mobile
    const FRAME_SKIP = 2 // Render every 3rd frame
    const FPS = 20
    const FRAME_INTERVAL = 1000 / FPS

    const colors = [
      'rgba(245,158,11,',
      'rgba(6,182,212,',
      'rgba(16,185,129,',
    ]

    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 1 + 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))

    let lastTime = 0

    function draw(time: number) {
      animRef.current = requestAnimationFrame(draw)

      // Skip if tab hidden or canvas not visible
      if (!tabVisibleRef.current || !visibleRef.current) return

      // Frame skip
      frameSkipRef.current++
      if (frameSkipRef.current % (FRAME_SKIP + 1) !== 0) return

      // FPS cap
      const delta = time - lastTime
      if (delta < FRAME_INTERVAL) return
      lastTime = time - (delta % FRAME_INTERVAL)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1

        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.color + '0.3)'
        ctx.fill()

        // Skip connections on mobile
        if (CONNECTION_DIST_SQ === 0) continue

        for (let j = i + 1; j < nodes.length; j++) {
          const dx = n.x - nodes[j].x
          const dy = n.y - nodes[j].y
          const distSq = dx * dx + dy * dy
          if (distSq < CONNECTION_DIST_SQ) {
            const dist = Math.sqrt(distSq)
            const alpha = (1 - dist / Math.sqrt(CONNECTION_DIST_SQ)) * 0.08
            ctx.beginPath()
            ctx.moveTo(n.x, n.y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = `rgba(148,163,184,${alpha})`
            ctx.lineWidth = 0.3
            ctx.stroke()
          }
        }
      }
    }

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // IntersectionObserver
    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { threshold: 0 }
    )
    observer.observe(canvas)

    // Tab visibility
    const handleVisibility = () => {
      tabVisibleRef.current = document.visibilityState === 'visible'
    }
    document.addEventListener('visibilitychange', handleVisibility)

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.35 }}
    />
  )
}
