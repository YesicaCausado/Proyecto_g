/**
 * PatternsTransition.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: la sección de los 5 patrones
 * neurodigitales de NeuroLearn, presentados como tarjetas.
 *
 * Evolución de la versión anterior:
 *   · Se reemplaza la tira de etiquetas planas por 5 tarjetas
 *     ricas (icono lucide + nombre + descripción + número).
 *   · La aparición la controla GSAP + ScrollTrigger con stagger
 *     y un ligero desplazamiento/escala (efecto premium, nada de
 *     rebotes infantiles).
 *   · Respeta prefers-reduced-motion y mantiene el aire oscuro y
 *     monocromo heredado del hero.
 *
 * Datos e iconos:
 *   · Los textos vienen de PATTERN_DETAILS (Single Source of Truth).
 *   · Los iconos se resuelven aquí por nombre (String → Componente)
 *     para evitar JSX dentro del config.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Eye, Mic, Keyboard, Users, TrendingUp,
} from 'lucide-react';

import PatternCard from './PatternCard';
import { HERO_PATTERNS, PATTERN_DETAILS } from '../config/hero.config';

gsap.registerPlugin(ScrollTrigger);

/** Mapeo nombre-de-icono → componente lucide */
const ICON_MAP: Record<string, typeof Eye> = {
  Eye,
  Mic,
  Keyboard,
  Users,
  TrendingUp,
};

export default function PatternsTransition() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef   = useRef<HTMLParagraphElement>(null);
  const titleRef   = useRef<HTMLHeadingElement>(null);
  const subRef     = useRef<HTMLParagraphElement>(null);
  const gridRef    = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cards = gridRef.current?.querySelectorAll('[data-pattern]');
    if (!cards || !cards.length) return;

    if (reduce) {
      gsap.set([labelRef.current, titleRef.current, subRef.current, cards], { opacity: 1, y: 0, scale: 1 });
      return;
    }

    gsap.set([labelRef.current, titleRef.current, subRef.current, cards], { opacity: 0, y: 24 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 60%',
        toggleActions: 'play none none none',
      },
    });

    // Encabezado primero
    tl.to(labelRef.current, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
      .to(titleRef.current, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.4')
      .to(subRef.current, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.4')
      // Luego las tarjetas con stagger + sutil escala (entrada cinematográfica)
      .to(cards, {
        opacity: 1,
        y: 0,
        scale: 1,
        stagger: 0.12,
        duration: 0.6,
        ease: 'power2.out',
      }, '-=0.25');

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      id="patrones"
      ref={sectionRef}
      className="relative"
      style={{
        minHeight: '110vh',
        background:
          'radial-gradient(120% 120% at 50% 80%, #101116 0%, #0a0b0d 55%, #050507 100%)',
        color: '#f5f5f5',
        padding: 'clamp(96px, 18vh, 180px) 5vw',
      }}
      aria-label="Los cinco patrones neurodigitales de NeuroLearn"
    >
      {/* Línea técnica decorativa superior (herencia del hero) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(220,220,220,0.22), transparent)',
        }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl">
        <p
          ref={labelRef}
          className="text-[11px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: 'rgba(220,220,220,0.60)' }}
        >
          Neuroanálisis en tiempo real
        </p>

        <h2
          ref={titleRef}
          className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl"
        >
          {HERO_PATTERNS.title}
        </h2>

        <p
          ref={subRef}
          className="mt-5 max-w-2xl text-base leading-relaxed"
          style={{ color: 'rgba(230,230,230,0.72)' }}
        >
          {HERO_PATTERNS.sub}
        </p>

        {/* Rejilla de tarjetas de los 5 patrones */}
        <div
          ref={gridRef}
          className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {PATTERN_DETAILS.map((p, i) => {
            const Icon = ICON_MAP[p.icon] ?? Eye;
            return (
              <a
                key={p.id}
                href={`#patron-${p.id}`}
                className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                aria-label={`Ver detalle del patrón ${p.title}`}
              >
                <PatternCard
                  index={i}
                  title={p.title}
                  description={p.description}
                  icon={<Icon size={20} strokeWidth={1.5} />}
                />
              </a>
            );
          })}
        </div>

        {/* Pista de que hay más abajo */}
        <p
          className="mt-14 text-[13px] tracking-wide"
          style={{ color: 'rgba(220,220,220,0.45)' }}
        >
          <span aria-hidden="true">↓</span> Toca cada patrón para ver qué señales analiza en
          profundidad.
        </p>
      </div>
    </section>
  );
}