/**
 * NeuralCanvasBackground.tsx
 * ─────────────────────────────────────────────────────────────
 * Fondo dinámico inspirado en una red neuronal (canvas 2D).
 *
 * · Nodos/partículas blancos/grises de baja opacidad + algunos
 *   nodos azules (#2563EB / #3B82F6).
 * · Líneas de conexión que aparecen/desaparecen progresivamente
 *   cuando los nodos están próximos.
 * · Animación lenta y elegante. Rendimiento: cuenta adaptativa
 *   según ancho/resolución y pausa con prefers-reduced-motion.
 *
 * Se usa como capa absoluta detrás del contenido.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef } from 'react';
import { RESPONSIVE } from '../config/landing.config';

interface Props {
  className?: string;
  caption?: 'dark' | 'light';
}

interface Node {
  x: number; y: number; vx: number; vy: number; r: number; blue: boolean;
}

export default function NeuralCanvasBackground({ className = '', caption = 'dark' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let w = 0, h = 0, nodes: Node[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const isMobile = window.innerWidth < RESPONSIVE.mobileBreakpoint;
    const count = isMobile ? RESPONSIVE.mobileParticles : RESPONSIVE.desktopParticles;

    const seed = () => {
      w = canvas.clientWidth || window.innerWidth;
      h = canvas.clientHeight || window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: Math.random() * 1.6 + 0.6,
        blue: Math.random() < 0.22,
      }));
    };

    const linkDist = Math.min(w, h) * 0.16;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Conexiones
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * 0.30;
            const blue = a.blue || b.blue;
            ctx.strokeStyle = blue
              ? `rgba(59,130,246,${alpha})`
              : caption === 'light' ? `rgba(5,5,5,${alpha * 0.5})` : `rgba(255,255,255,${alpha * 0.5})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Nodos
      for (const n of nodes) {
        ctx.beginPath();
        if (n.blue) {
          ctx.fillStyle = 'rgba(59,130,246,0.7)';
          ctx.shadowColor = 'rgba(59,130,246,0.6)';
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = caption === 'light' ? 'rgba(5,5,5,0.22)' : 'rgba(255,255,255,0.35)';
          ctx.shadowBlur = 0;
        }
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const step = () => {
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      draw();
      if (!reduce) raf = requestAnimationFrame(step);
    };

    seed();
    if (reduce) {
      draw(); // frame estático
    } else {
      raf = requestAnimationFrame(step);
    }

    const onResize = () => { seed(); if (reduce) draw(); };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [caption]);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}