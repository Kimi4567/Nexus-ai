// @ts-nocheck
'use client'

import { useEffect, useRef } from 'react'

/* ═══════════════════════════════════════════════════════════════
   NeuralCanvas v2 — Performance-Optimized
   • Static on first paint, minimal animation
   • Pauses when not visible (IntersectionObserver)
   • Reduced node count (20 max)
   • No connections on mobile
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
  const frameCountRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const isMobile = window.innerWidth < 768
    const NODE_COUNT = isMobile ? 12 : 20
    const CONNECTION_DIST = isMobile ? 0 : 100 // No connections on mobile

    // Reduce to 30fps on all devices
    const FPS = isMobile ? 20 : 30
    const FRAME_INTERVAL = 1000 / FPS

    const colors = [
      'rgba(245,158,11,',
      'rgba(6,182,212,',
      'rgba(16,185,129,',
    ]

    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.2 + 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))

    let lastTime = 0

    function draw(time: number) {
      animRef.current = requestAnimationFrame(draw)

      if (!visibleRef.current) return

      const delta = time - lastTime
      if (delta < FRAME_INTERVAL) return
      lastTime = time - (delta % FRAME_INTERVAL)

      frameCountRef.current++
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > canvas!.width) n.vx *= -1
        if (n.y < 0 || n.y > canvas!.height) n.vy *= -1

        ctx!.beginPath()
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx!.fillStyle = n.color + '0.35)'
        ctx!.fill()

        // Skip connections on mobile — too expensive
        if (CONNECTION_DIST === 0) continue

        // Only draw connections every 3rd frame
        if (frameCountRef.current % 3 !== 0) continue

        for (let j = i + 1; j < nodes.length; j++) {
          const dx = n.x - nodes[j].x
          const dy = n.y - nodes[j].y
          const distSq = dx * dx + dy * dy
          if (distSq < CONNECTION_DIST * CONNECTION_DIST) {
            const dist = Math.sqrt(distSq)
            const alpha = (1 - dist / CONNECTION_DIST) * 0.1
            ctx!.beginPath()
            ctx!.moveTo(n.x, n.y)
            ctx!.lineTo(nodes[j].x, nodes[j].y)
            ctx!.strokeStyle = `rgba(148,163,184,${alpha})`
            ctx!.lineWidth = 0.4
            ctx!.stroke()
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

    // IntersectionObserver — pause when not visible
    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { threshold: 0 }
    )
    observer.observe(canvas)

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.45 }}
    />
  )
}
