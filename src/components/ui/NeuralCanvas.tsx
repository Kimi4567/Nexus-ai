'use client';

import { useEffect, useRef } from 'react';

export default function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let fc = 0;
    const N = 35;
    const D = 120;

    const ns: { x: number; y: number; vx: number; vy: number; r: number; cb: string }[] = [];
    for (let i = 0; i < N; i++) {
      const cols = ['rgba(245,158,11,', 'rgba(6,182,212,', 'rgba(16,185,129,', 'rgba(244,63,94,'];
      ns.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
        cb: cols[Math.floor(Math.random() * cols.length)],
      });
    }

    function resize(cv: HTMLCanvasElement) {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    }

    function anim() {
      fc++;
      if (window.innerWidth < 768 && fc % 2 !== 0) {
        animId = requestAnimationFrame(anim);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.cb + '0.4)';
        ctx.fill();
        for (let j = i + 1; j < ns.length; j++) {
          const dx = n.x - ns[j].x;
          const dy = n.y - ns[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < D) {
            const a = (1 - dist / D) * 0.15;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(ns[j].x, ns[j].y);
            ctx.strokeStyle = `rgba(148,163,184,${a})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(anim);
    }

    window.addEventListener('resize', () => resize(canvas));
    resize(canvas);
    anim();

    return () => {
      window.removeEventListener('resize', () => resize(canvas));
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, opacity: 0.6 }} />;
}
