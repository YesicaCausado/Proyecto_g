/**
 * NeuronParticleSystem.tsx
 * ─────────────────────────────────────────────────────────────
 * Capa de partículas que se "conectan" en red neuronal durante
 * la animación de entrada del Hero. Usa canvas 2D para rendimiento.
 *
 * Protocolo de entrada (sage a sage):
 *   1. Pocas partículas aparecen.
 *   2. Las partículas empiezan a conectarse (progresión conn).
 *   3. Aparece progresivamente el glow azul (progresión glow).
 *
 * Se controla externamente vía un ref expuesto o prop `progress`
 * (0..1). Si no se pasa progress, corre su secuencia interna.
 * ─────────────────────────────────────────────────────────────
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { RESPONSIVE } from '../config/landing.config';

export interface NeuronParticleSystemHandle {
  /** fuerza la fase de conexión + glow (0..1) */
  connect: (progress: number) => void;
}

interface Props {
  className?: string;
}

interface P {
  x: number; y: number; r: number;
  baseAlpha: number;
  blue: boolean;
}

const NeuronParticleSystem = forwardRef<NeuronParticleSystemHandle, Props>(
  function NeuronParticleSystem({ className = '' }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
      connect: (p: number) => {
        stateRef.current.connect = Math.min(1, Math.max(0, p));
        stateRef.current.glow = stateRef.current.connect;
      },
    }), []);

    // Estado interno mutado por el loop
    const stateRef = useRef<{ connect: number; glow: number }>({ connect: 0, glow: 0 });

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let raf = 0;
      let w = 0, h = 0;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let particles: P[] = [];
      const isMobile = window.innerWidth < RESPONSIVE.mobileBreakpoint;
      const count = isMobile ? 34 : 64;

      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const seed = () => {
        w = canvas.clientWidth || window.innerWidth;
        h = canvas.clientHeight || window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        particles = Array.from({ length: count }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.4 + 0.7,
          baseAlpha: Math.random() * 0.5 + 0.3,
          blue: Math.random() < 0.5,
        }));
      };

      const linkDist = Math.min(w, h) * 0.22;

      const draw = () => {
        ctx.clearRect(0, 0, w, h);
        const conn = stateRef.current.connect;
        const glow = stateRef.current.glow;

        // Conexiones progresivas
        if (conn > 0) {
          for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
              const a = particles[i], b = particles[j];
              const dist = Math.hypot(a.x - b.x, a.y - b.y);
              if (dist < linkDist) {
                // Solo algunas se activan según el progreso de "conexión"
                const local = (j - i) % 7;
                const gate = local / 7;
                if (gate < conn) {
                  const alpha = (1 - dist / linkDist) * 0.22;
                  ctx.strokeStyle = `rgba(96,165,250,${alpha})`;
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(a.x, a.y);
                  ctx.lineTo(b.x, b.y);
                  ctx.stroke();
                }
              }
            }
          }
        }

        // Partículas
        for (const p of particles) {
          ctx.beginPath();
          ctx.fillStyle = p.blue
            ? `rgba(96,165,250,${p.baseAlpha})`
            : `rgba(255,255,255,${p.baseAlpha * 0.6})`;
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Glow central progresivo azul
        if (glow > 0.01) {
          const cx = w / 2, cy = h / 2;
          const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.min(w, h) * 0.45);
          g.addColorStop(0, `rgba(37,99,235,${0.20 * glow})`);
          g.addColorStop(1, 'rgba(37,99,235,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
      };

      if (reduce) { draw(); return () => {}; }

      const step = () => {
        draw();
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      seed();

      const onResize = seed;
      window.addEventListener('resize', onResize);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
    );
  },
);

export default NeuronParticleSystem;