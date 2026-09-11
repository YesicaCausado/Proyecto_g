/**
 * HeroFinal.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: la sección de CIERRE de la Landing —
 * "Neurón vuelve a ser protagonista" con un CTA grande y una
 * transición llamativa (paso "Final" del plan de la landing).
 *
 * Técnica (solo GSAP core + ScrollTrigger, sin dependencias nuevas):
 *   · Neurón ligero (NeuronAvatar /2d.png) entra con escala/flotación.
 *   · Texto editorial entra por capas con stagger.
 *   · Puntos decorativos flotan con GSAP.
 *   · prefers-reduced-motion → estado estático visible.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import NeuronAvatar from '../../../components/NeuronAvatar';
import NeuroParticles from './NeuroParticles';

gsap.registerPlugin(ScrollTrigger);

const DOTS: { x: string; y: string; size: number; color: string; delay: number }[] = [
  { x: '14%',  y: '24%', size: 7,  color: '#5DC8B4', delay: 0.1 },
  { x: '82%',  y: '18%', size: 6,  color: '#3FA9DB', delay: 0.4 },
  { x: '20%',  y: '72%', size: 5,  color: '#F2C84B', delay: 0.7 },
  { x: '78%',  y: '64%', size: 8,  color: '#A78BFA', delay: 1.0 },
  { x: '10%',  y: '45%', size: 4,  color: '#35B98B', delay: 1.3 },
  { x: '88%',  y: '82%', size: 5,  color: '#5DC8B4', delay: 1.6 },
];

export default function HeroFinal() {
  const sectionRef = useRef<HTMLElement>(null);
  const scopeRef   = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const scope   = scopeRef.current;
    if (!section || !scope) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      const reveals = '.fin-reveal';
      if (reduce) {
        gsap.set([reveals, '.fin-avatar', '.fin-dot'], { opacity: 1 });
        return;
      }

      gsap.set('.fin-avatar', { opacity: 0, scale: 0.7 });
      gsap.set(reveals, { opacity: 0, y: 34 });
      gsap.set('.fin-dot', { opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 62%',
          toggleActions: 'play none none none',
        },
        defaults: { ease: 'power2.out' },
      });

      // Neurón entra (wrapper) — la flotación va en un contenedor interno.
      tl.to('.fin-avatar', { opacity: 1, scale: 1, duration: 1 }, 0)
        .to(reveals, { opacity: 1, y: 0, duration: 0.8, stagger: 0.12 }, '-=0.55')
        .to('.fin-dot', { opacity: 1, duration: 0.6, stagger: 0.12 }, '-=0.5');

      // Neurón flota de forma continua (solo y, sin tocar la entrada).
      gsap.to('.fin-avatar-float', {
        y: '-=10',
        duration: 3.5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      // Puntos decorativos flotando en direcciones aleatorias sutilmente.
      gsap.utils.toArray<HTMLElement>('.fin-dot').forEach((d, i) => {
        gsap.to(d, {
          y: () => gsap.utils.random(-14, 14),
          x: () => gsap.utils.random(-12, 12),
          duration: gsap.utils.random(2.5, 4.5),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: DOTS[i]?.delay ?? 0,
        });
      });
    }, scope);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(120% 120% at 50% 20%, #0b1116 0%, #06090c 55%, #030405 100%)',
        color: '#eef2f1',
      }}
      aria-label="Cierra tu decisión de conocer NeuroLearn"
    >
      {/* Campo de partículas 3D (drei) detrás de todo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
        <NeuroParticles />
      </div>

      {/* Puntos decorativos */}
      <div ref={scopeRef} className="absolute inset-0" aria-hidden="true">
        {DOTS.map((d, i) => (
          <span
            key={i}
            className="fin-dot absolute rounded-full"
            style={{
              left: d.x,
              top: d.y,
              width: d.size,
              height: d.size,
              background: d.color,
              boxShadow: `0 0 ${d.size * 2}px ${d.color}88`,
            }}
          />
        ))}

        {/* Contenido */}
        <div className="relative z-[1] flex min-h-screen flex-col items-center justify-center px-6 pb-16 pt-24 text-center">
          {/* Neurón protagonista (avatar 2D ligero, flotando) */}
          <div className="fin-avatar mb-8">
            <div className="fin-avatar-float relative">
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: 'min(46vw, 260px)',
                  height: 'min(46vw, 260px)',
                  background: 'radial-gradient(circle, rgba(94,200,180,0.18) 0%, rgba(63,169,219,0.06) 48%, transparent 72%)',
                  filter: 'blur(10px)',
                }}
              />
              <NeuronAvatar size={124} className="relative z-10" />
            </div>
          </div>

          {/* Eyebrow */}
          <p className="landing-kicker fin-reveal" style={{ color: '#3FA9DB' }}>
            <span aria-hidden="true" style={{ color: '#5DC8B4' }}>●</span>
            Listo para empezar a aprender contigo
          </p>

          {/* Headline editorial */}
          <h2 className="landing-serif fin-reveal mt-6 max-w-4xl text-4xl font-medium leading-[1.02] tracking-tight text-white sm:text-6xl">
            Deja que <span className="font-light italic" style={{ color: '#5DC8B4' }}>Neuron</span> aprenda
            <br />
            contigo, en cada señal
            <span aria-hidden="true" style={{ color: '#3FA9DB' }}>.</span>
          </h2>

          <p
            className="landing-sans fin-reveal mt-7 max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ color: 'rgba(232,236,234,0.82)' }}
          >
            Crea tu cuenta gratis y descubre cómo los patrones de voz, rostro, teclado,
            interacción y rendimiento se convierten en un aprendizaje verdaderamente adaptativo.
          </p>

          {/* CTA final */}
          <div className="fin-reveal mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <a
              href="#/login"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full px-8 py-4 text-[15px] font-semibold text-[#06131a] transition-none"
              style={{
                background: 'linear-gradient(92deg, #5DC8B4 0%, #3FA9DB 100%)',
                boxShadow: '0 12px 32px rgba(61,126,171,0.35)',
              }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)', backgroundSize: '220% 100%', backgroundPosition: '120% 0' }} />
              Empezar gratis
              <span aria-hidden="true" className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
            <a
              href="#patrones"
              className="fin-reveal inline-flex items-center gap-2 rounded-full border px-7 py-4 text-[15px] font-semibold transition-transform duration-300 hover:-translate-y-0.5"
              style={{ borderColor: 'rgba(238,242,241,0.28)', color: '#eef2f1' }}
            >
              Volver a los patrones
            </a>
          </div>

          {/* Nota al pie */}
          <p className="landing-mono fin-reveal mt-12 text-[11px] uppercase tracking-[0.28em]" style={{ color: 'rgba(226,232,230,0.55)' }}>
            neurolearn · aprendizaje adaptativo
          </p>
        </div>
      </div>
    </section>
  );
}