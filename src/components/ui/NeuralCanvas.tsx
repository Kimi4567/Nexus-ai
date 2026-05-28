'use client';

import { useEffect, useRef } from 'react';

export default function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const x = c.getContext('2d');
    if (!x) return;

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

    function resize() {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    }

    function anim() {
      fc++;
      if (window.innerWidth < 768 && fc % 2 !== 0) {
        animId = requestAnimationFrame(anim);
        return;
      }
      x.clearRect(0, 0, c.width, c.height);
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > c.width) n.vx *= -1;
        if (n.y < 0 || n.y > c.height) n.vy *= -1;
        x.beginPath();
        x.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        x.fillStyle = n.cb + '0.4)';
        x.fill();
        for (let j = i + 1; j < ns.length; j++) {
          const dx = n.x - ns[j].x;
          const dy = n.y - ns[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < D) {
            const a = (1 - dist / D) * 0.15;
            x.beginPath();
            x.moveTo(n.x, n.y);
            x.lineTo(ns[j].x, ns[j].y);
            x.strokeStyle = `rgba(148,163,184,${a})`;
            x.lineWidth = 0.5;
            x.stroke();
          }
        }
      }
      animId = requestAnimationFrame(anim);
    }

    window.addEventListener('resize', resize);
    resize();
    anim();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, opacity: 0.6 }} />;
}
