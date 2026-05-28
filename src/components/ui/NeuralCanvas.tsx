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
    let frameCount = 0;
    const NODE_COUNT = 35;
    const CONNECTION_DIST = 120;

    const nodes: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      cb: string;
    }[] = [];

    for (let i = 0; i < NODE_COUNT; i++) {
      const colors = [
        'rgba(245,158,11,',
        'rgba(6,182,212,',
        'rgba(16,185,129,',
        'rgba(244,63,94,',
      ];
      nodes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
        cb: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    function draw() {
      frameCount++;
      if (window.innerWidth < 768 && frameCount % 2 !== 0) {
        animId = requestAnimationFrame(draw);
        return;
      }

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas!.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas!.height) n.vy *= -1;

        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle = n.cb + '0.4)';
        ctx!.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const dx = n.x - nodes[j].x;
          const dy = n.y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.15;
            ctx!.beginPath();
            ctx!.moveTo(n.x, n.y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.strokeStyle = `rgba(148,163,184,${alpha})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    });

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.6 }}
    />
  );
}
