/**
 * Hero.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: el HERO a pantalla completa de la Landing
 * de NeuroLearn. Debe sentirse como una experiencia interactiva,
 * no como una sección web.
 *
 * Animación (GSAP):
 *   1. ENTRADA — timeline cinematográfico por pasos:
 *        Paso 1: fondo blanco limpio
 *        Paso 2: Neurón entra (opacity / scale / y / rotación)
 *        Paso 3: nodos/partículas alrededor aparecen (stagger)
 *        Paso 4: NEUROLEARN
 *        Paso 5: mensaje principal + CTAs (fade/slide staggered)
 *   2. FLOTACIÓN — tween infinito y elegante sobre el wrapper de Neurón.
 *   3. MOUSE — parallax 3D con easing (rotateX/rotateY/translate).
 *   4. SCROLL — ScrollTrigger scrubbed: white → dark, Neurón se
 *      desplaza/escala/rota, el texto sale más rápido (parallax),
 *      fundiéndose hacia la sección de patrones.
 *
 * Accesibilidad: prefers-reduced-motion → salta a estado final
 * sin animación y evita parallax/flotación.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import gsap    from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import HeroRobot, { type HeroRobotHandle } from './HeroRobot';
import NeuronField    from './NeuronField';
import { useHeroMouseParallax } from '../hooks/useHeroMouseParallax';
import {
  HERO_BRAND,
  HERO_COPY,
  HERO_ROBOT,
  HERO_SCROLL,
  HERO_TIMING,
  HERO_RESPONSIVE,
} from '../config/hero.config';

gsap.registerPlugin(ScrollTrigger);

function usePrefersReducedMotion(): boolean {
  const ref = useRef<boolean>(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  return ref.current;
}

export default function Hero() {
  const reduceMotion = usePrefersReducedMotion();

  // Refs
  const sectionRef    = useRef<HTMLElement>(null);
  const bgLightRef    = useRef<HTMLDivElement>(null);
  const bgDarkRef     = useRef<HTMLDivElement>(null);
  const glowRef       = useRef<HTMLDivElement>(null);
  const fadeRef       = useRef<HTMLDivElement>(null);
  const robotWrapRef  = useRef<HeroRobotHandle>(null);
  const nodesRef      = useRef<HTMLDivElement>(null);
  const brandRef      = useRef<HTMLHeadingElement>(null);
  const headlineRef   = useRef<HTMLHeadingElement>(null);
  const subRef        = useRef<HTMLParagraphElement>(null);
  const ctaRef        = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < HERO_RESPONSIVE.mobileBreakpoint;

  // Parallax de mouse → inclinación 3D sutil de Neurón (autodesactivable
  // en touch / prefers-reduced-motion).
  useHeroMouseParallax(() => robotWrapRef.current?.wrapper ?? null, !reduceMotion && !isMobile);

  useLayoutEffect(() => {
    const section   = sectionRef.current;
    if (!section) return;

    const robot    = robotWrapRef.current?.wrapper ?? null;
    const robotFloat = robotWrapRef.current?.float ?? null;
    const nodes    = nodesRef.current;
    const brand    = brandRef.current;
    const headline = headlineRef.current;
    const sub      = subRef.current;
    const cta      = ctaRef.current;
    const scrollHint = scrollHintRef.current;
    const bgLight  = bgLightRef.current;
    const bgDark   = bgDarkRef.current;
    const glow     = glowRef.current;
    const fade     = fadeRef.current;

    // ── ESTADO INICIAL ─────────────────────────────────────
    // Bajo reduced-motion no ocultamos nada: mostramos el estado final
    // y saltamos la animación de entrada (accesibilidad).
    //
    // Defensa StrictMode/refs: GSAP 3.15 lanza "Cannot read properties
    // of null (reading '_gsap')" si un arreglo de targets contiene un
    // elemento null. Bajo React 19 (StrictMode reinvoca useLayoutEffect
    // y puede haber re-appear de effects con refs momentáneamente null),
    // filtramos los targets antes de pasárselos a GSAP.
    const contentTargets = [brand, headline, sub, cta, scrollHint].filter(
      Boolean,
    ) as Element[];

    if (bgLight) gsap.set(bgLight, { opacity: 1 });
    if (bgDark) gsap.set(bgDark, { opacity: 0 });
    if (glow) gsap.set(glow, { opacity: 0 });

    if (reduceMotion) {
      // Estado final visible sin animación
      if (robot) gsap.set(robot, {
        y: 0,
        scale: isMobile ? HERO_RESPONSIVE.mobileRobotScale : HERO_ROBOT.scale,
        rotation: 0,
        opacity: 1,
      });
      gsap.set(contentTargets, { opacity: 1 });
    } else {
      // Punto de partida de la animación de entrada
      gsap.set(contentTargets, { opacity: 0 });
      if (robot) gsap.set(robot, {
        y: HERO_ROBOT.entranceY,
        scale: (isMobile ? HERO_RESPONSIVE.mobileRobotScale : HERO_ROBOT.scale) * HERO_ROBOT.entranceScale,
        rotation: HERO_ROBOT.entranceRotation,
        opacity: 0,
      });
    }

    // ── Colector de limpieza — se mata en unmount / StrictMode ─
    let entranceTl: gsap.core.Timeline | undefined;
    let scrollTl:   gsap.core.Timeline | undefined;
    let floatTween: gsap.core.Tween | null = null;

    if (!reduceMotion) {
      // ── ENTRADA — timeline por pasos ───────────────────────
      entranceTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      const tl    = entranceTl;

      // Paso 2 — Neurón entra en escena (crece + sube + rota)
      if (robot) {
        tl.to(robot, {
          y: 0,
          scale: isMobile ? HERO_RESPONSIVE.mobileRobotScale : HERO_ROBOT.scale,
          rotation: 0,
          opacity: 1,
          duration: 1.5,
          ease: 'power2.out',
        }, HERO_TIMING.step2Robot);
      }

      // Paso 3 — nodos del campo aparecen con stagger
      if (nodes) {
        tl.to(nodes.querySelectorAll('.hero-node'), {
          opacity: 1,
          stagger: HERO_TIMING.stagger * 0.5,
          duration: 0.7,
          ease: 'power1.out',
        }, HERO_TIMING.step3Nodes);
      }

      // Paso 4 — NEUROLEARN
      if (brand) {
        tl.fromTo(brand, { y: 24, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.9,
        }, HERO_TIMING.step4Brand);
      }

      // Paso 5 — mensaje + sublínea + CTA (stagger)
      if (headline) {
        tl.fromTo(headline, { y: 28, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.9,
        }, HERO_TIMING.step5Copy);
      }
      if (sub) {
        tl.fromTo(sub, { y: 20, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.8,
        }, HERO_TIMING.step5Copy + HERO_TIMING.stagger);
      }
      if (cta) {
        tl.fromTo(cta, { y: 16, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.7,
        }, HERO_TIMING.step5Copy + HERO_TIMING.stagger * 2);
      }

      // Glow sutil + scroll hint al final
      if (scrollHint) {
        tl.fromTo(scrollHint, { opacity: 0 }, { opacity: 1, duration: 0.6 },
          HERO_TIMING.step5Copy + HERO_TIMING.stagger * 3);
      }

      // ── FLOTACIÓN continua (solo desktop, no reduced-motion) ─
      if (robotFloat && !isMobile) {
        floatTween = gsap.to(robotFloat, {
          y: `+=${HERO_ROBOT.floatAmplitude}`,
          duration: HERO_ROBOT.floatDuration,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }

      // ── SCROLL TRIGGER — transición cinematográfica ────────
      // El trigger es el mismo hero; el scrub recorre la zona
      // hero + parte de la sección de patrones.
      scrollTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: section,
          start: HERO_SCROLL.start,
          end: HERO_SCROLL.end,
          scrub: 0.6,
          // invalidateOnRefresh para recomputar en responsive
          invalidateOnRefresh: true,
        },
      });

      // Blanco → oscuro (cambio gradual, no instantáneo)
      if (bgLight && bgDark) {
        scrollTl.to(bgLight, { opacity: 0, duration: 1 }, 0);
        scrollTl.to(bgDark,  { opacity: 1, duration: 1 }, 0);
        scrollTl.to(glow,    { opacity: 0.9, duration: 1.2 }, 0.1);
      }

      // El fade inferior inferior se retira conforme oscurece el fondo
      // (evita una mancha blanca sobre la zona oscura).
      if (fade) {
        scrollTl.to(fade, { opacity: 0, duration: 1 }, 0.05);
      }

      // Neurón se desplaza hacia arriba, se achica levemente y
      // rota — como si entrara "hacia dentro del mundo".
      if (robot) {
        scrollTl.to(robot, {
          y: HERO_SCROLL.robotUpTravel,
          scale: (isMobile ? HERO_RESPONSIVE.mobileRobotScale : HERO_ROBOT.scale) * HERO_SCROLL.robotScrollScale,
          rotation: HERO_SCROLL.robotScrollRotation,
          duration: 1,
        }, 0);
      }

      // Texto sale MÁS rápido que Neurón → parallax de profundidad
      const copyOut = { duration: 0.8, opacity: 0, y: HERO_SCROLL.textTravel * 0.35, scale: 0.96 };
      scrollTl.to(contentTargets, copyOut, 0.05);

      // Nodos se dispersan hacia afuera y se desvanecen
      if (nodes) {
        scrollTl.to(nodes, { opacity: 0, x: 30, scale: 1.05, duration: 1 }, 0);
      }
    }

    // ── Limpieza — evita memory leaks / ScrollTriggers huérfanos ─
    return () => {
      entranceTl?.kill();
      floatTween?.kill();
      scrollTl?.scrollTrigger?.kill();
      scrollTl?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ height: '100vh', minHeight: '640px' }}
      aria-label="NeuroLearn — hero"
      data-hero="section"
    >
      {/* ── Capas de fondo (white → dark por scroll) ─────────── */}
      <div
        ref={bgLightRef}
        className="absolute inset-0 bg-white"
        data-hero="bg-light"
      />
      <div
        ref={bgDarkRef}
        className="absolute inset-0 text-neutral-100"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 10%, #15161a 0%, #0c0d10 55%, #050507 100%)',
          opacity: 0,
        }}
        data-hero="bg-dark"
      />
      {/* Glow técnico sobre el fondo oscuro */}
      <div
        ref={glowRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(40% 40% at 50% 40%, rgba(155,150,247,0.14) 0%, transparent 70%)',
          opacity: 0,
        }}
        aria-hidden="true"
      />

      {/* ── Neurón real (wrapper animado por GSAP) ───────────── */}
      <HeroRobot
        ref={robotWrapRef}
        top={isMobile ? HERO_RESPONSIVE.mobileTop : HERO_ROBOT.top}
        scale={isMobile ? HERO_RESPONSIVE.mobileRobotScale : HERO_ROBOT.scale}
      />

      {/* Fade inferior: integra al robot con la zona oscura y evita
          un corte seco (menos ruido visual). Se funde según fondo. */}
      <div
        ref={fadeRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[6]"
        style={{ height: '30vh', background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.9) 70%, #ffffff)' }}
        data-hero="bottom-fade"
        aria-hidden="true"
      />

      {/* ── Campo de nodos sutiles ───────────────────────────── */}
      <NeuronField />

      {/* ── Contenido del hero ───────────────────────────────── */}
      <div className="absolute inset-x-0 top-0 z-20 flex flex-col items-center px-6 pt-20 sm:pt-24 text-center"
        style={{ pointerEvents: 'none' }}>
        {/* Marca */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em]"
            style={{
              borderColor: 'rgba(55,53,47,0.18)',
              color: '#2b2a27',
              backgroundColor: 'rgba(255,255,255,0.7)',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
            NeuroLearn
          </span>
        </div>

        {/* Título principal */}
        <h1
          ref={brandRef}
          className="font-black uppercase tracking-[0.12em] text-[#0c0d10]"
          style={{
            fontSize: 'clamp(34px, 6.5vw, 72px)',
            lineHeight: 1,
            textShadow: '0 2px 24px rgba(255,255,255,0.55)',
          }}
        >
          {HERO_BRAND}
        </h1>

        <div className="mt-8 max-w-3xl">
          <h2
            ref={headlineRef}
            className="font-bold text-[#111] leading-tight tracking-tight"
            style={{
              fontSize: 'clamp(22px, 3.4vw, 44px)',
              textShadow: '0 2px 16px rgba(255,255,255,0.5)',
            }}
          >
            {HERO_COPY.headlineA}<br />
            <span className="font-extrabold">{HERO_COPY.headlineB}</span>
          </h2>
          <p
            ref={subRef}
            className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed sm:text-[17px]"
            style={{ color: '#3f3e3a' }}
          >
            {HERO_COPY.subline}
          </p>
        </div>

        {/* CTAs con microinteracción */}
        <div ref={ctaRef} className="mt-10 flex flex-wrap items-center justify-center gap-4"
          style={{ pointerEvents: 'auto' }}>
          <a
            href="#patrones"
            className="hero-cta hero-cta-primary inline-flex items-center gap-2 rounded-full px-7 py-3 text-[15px] font-semibold text-white transition-none"
            style={{ background: '#0c0d10' }}
          >
            {HERO_COPY.ctaPrimary}
            <span aria-hidden="true">→</span>
          </a>
          <a
            href="#patrones"
            className="hero-cta hero-cta-secondary inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[15px] font-semibold transition-none"
            style={{ borderColor: '#0c0d10', color: '#0c0d10', backgroundColor: 'rgba(255,255,255,0.6)' }}
          >
            {HERO_COPY.ctaSecondary}
          </a>
        </div>

        {/* Indicador de scroll */}
        <div
          ref={scrollHintRef}
          className="mt-14 flex flex-col items-center gap-2"
          data-hero="scroll-hint"
        >
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#8b8a86]">
            Desliza para entrar
          </span>
          <span className="flex h-8 w-5 items-start justify-center rounded-full border border-[#bdbcB8] p-1">
            <span className="hero-scroll-dot h-1.5 w-1.5 rounded-full bg-neutral-900" />
          </span>
        </div>
      </div>
    </section>
  );
}