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
import { useLayoutEffect, useRef, useState } from 'react';
import gsap    from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import HeroRobot, { type HeroRobotHandle } from './HeroRobot';
import NeuronField    from './NeuronField';
import { useHeroMouseParallax } from '../hooks/useHeroMouseParallax';
import {
  HERO_AESTHETIC,
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
  const gridRef       = useRef<HTMLDivElement>(null);
  const glowRef       = useRef<HTMLDivElement>(null);
  const fadeRef       = useRef<HTMLDivElement>(null);
  const robotWrapRef  = useRef<HeroRobotHandle>(null);
  const nodesRef      = useRef<HTMLDivElement>(null);
  const brandRef      = useRef<HTMLHeadingElement>(null);
  const headlineRef   = useRef<HTMLHeadingElement>(null);
  const subRef        = useRef<HTMLParagraphElement>(null);
  const ctaRef        = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);

  // Mouse position for neuronal field interaction. Estado React (no un
  // ref) para que NeuronField re-renderice y aplique el parallax a cada
  // nodo vía transform; normalizado a [-1, 1].
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const isMouseTrackingEnabled = useRef<boolean>(true);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < HERO_RESPONSIVE.mobileBreakpoint;

  // Parallax de mouse → inclinación 3D sutil de Neurón (autodesactivable
  // en touch / prefers-reduced-motion).
  useHeroMouseParallax(() => robotWrapRef.current?.wrapper ?? null, !reduceMotion && !isMobile);

  // Track mouse position for neuronal field. Throttled por rAF.
  useLayoutEffect(() => {
    if (!isMouseTrackingEnabled.current) return;
    let raf = 0;
    const handleMouseMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setMouse({
          x: (e.clientX / window.innerWidth) * 2 - 1,
          y: (e.clientY / window.innerHeight) * 2 - 1,
        });
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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
    const grid     = gridRef.current;
    const glow     = glowRef.current;
    const fade     = fadeRef.current;

    const contentTargets = [brand, headline, sub, cta, scrollHint].filter(
      Boolean,
    ) as Element[];

    if (bgLight) gsap.set(bgLight, { opacity: 1 });
    if (bgDark) gsap.set(bgDark, { opacity: 0 });
    if (glow) gsap.set(glow, { opacity: 0 });

    if (reduceMotion) {
      if (robot) gsap.set(robot, {
        y: 0,
        scale: isMobile ? HERO_RESPONSIVE.mobileRobotScale : HERO_ROBOT.scale,
        rotation: 0,
        opacity: 1,
      });
      gsap.set(contentTargets, { opacity: 1 });
      gsap.set(nodes?.querySelectorAll('.hero-node') ?? [], { opacity: 1 });
    } else {
      gsap.set(contentTargets, { opacity: 0 });
      if (robot) gsap.set(robot, {
        y: HERO_ROBOT.entranceY,
        scale: (isMobile ? HERO_RESPONSIVE.mobileRobotScale : HERO_ROBOT.scale) * HERO_ROBOT.entranceScale,
        rotation: HERO_ROBOT.entranceRotation,
        opacity: 0,
      });
    }

    let entranceTl: gsap.core.Timeline | undefined;
    let scrollTl:   gsap.core.Timeline | undefined;
    let floatTween: gsap.core.Tween | null = null;

    if (!reduceMotion) {
      entranceTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      const tl    = entranceTl;

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

      if (nodes) {
        tl.to(nodes.querySelectorAll('.hero-node'), {
          opacity: 1,
          stagger: HERO_TIMING.stagger * 0.5,
          duration: 0.7,
          ease: 'power1.out',
        }, HERO_TIMING.step3Nodes);
      }

      if (brand) {
        tl.fromTo(brand, { y: 24, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.9,
        }, HERO_TIMING.step4Brand);
      }

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

      if (scrollHint) {
        tl.fromTo(scrollHint, { opacity: 0 }, { opacity: 1, duration: 0.6 },
          HERO_TIMING.step5Copy + HERO_TIMING.stagger * 3);
      }

      if (robotFloat && !isMobile) {
        floatTween = gsap.to(robotFloat, {
          y: `+=${HERO_ROBOT.floatAmplitude}`,
          duration: HERO_ROBOT.floatDuration,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }

      scrollTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: section,
          start: HERO_SCROLL.start,
          end: HERO_SCROLL.end,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });

      if (bgLight && bgDark) {
        scrollTl.to(bgLight, { opacity: 0, duration: 1 }, 0);
        scrollTl.to(bgDark,  { opacity: 1, duration: 1 }, 0);
        scrollTl.to(glow,    { opacity: 0.9, duration: 1.2 }, 0.1);
      }

      if (grid) {
        scrollTl.to(grid, { opacity: 0, duration: 1 }, 0);
      }

      if (fade) {
        scrollTl.to(fade, { opacity: 0, duration: 1 }, 0.05);
      }

      if (robot) {
        scrollTl.to(robot, {
          y: HERO_SCROLL.robotUpTravel,
          scale: (isMobile ? HERO_RESPONSIVE.mobileRobotScale : HERO_ROBOT.scale) * HERO_SCROLL.robotScrollScale,
          rotation: HERO_SCROLL.robotScrollRotation,
          duration: 1,
        }, 0);
      }

      const copyOut = { duration: 0.8, opacity: 0, y: HERO_SCROLL.textTravel * 0.35, scale: 0.96 };
      scrollTl.to(contentTargets, copyOut, 0.05);

      if (nodes) {
        scrollTl.to(nodes, { opacity: 0, x: 30, scale: 1.05, duration: 1 }, 0);
      }
    }

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
      id="hero"
      data-hero="section"
    >
      {/* ── Capas de fondo (white → dark por scroll) ─────────── */}
      <div
        ref={bgLightRef}
        className="absolute inset-0 bg-white"
        data-hero="bg-light"
      />
      <div
        ref={gridRef}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        data-hero="bg-grid"
        style={{
          backgroundImage: [
            `linear-gradient(to bottom, ${HERO_AESTHETIC.grid.lineH} 1px, transparent 1px)`,
            `linear-gradient(to right, ${HERO_AESTHETIC.grid.lineV} 1px, transparent 1px)`,
          ].join(', '),
          backgroundSize: `${HERO_AESTHETIC.grid.cell}px ${HERO_AESTHETIC.grid.cell}px`,
          backgroundPosition: 'center top',
          maskImage: `${HERO_AESTHETIC.gridFadeTop}, ${HERO_AESTHETIC.gridFadeBottom}`,
          maskComposite: 'intersect',
          WebkitMaskImage: `${HERO_AESTHETIC.gridFadeTop}, ${HERO_AESTHETIC.gridFadeBottom}`,
          WebkitMaskComposite: 'source-in',
        }}
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
      <div
        ref={glowRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(42% 42% at 50% 40%, ${HERO_AESTHETIC.glowDark.center} 0%, ${HERO_AESTHETIC.glowDark.edge} 70%)`,
          opacity: 0,
        }}
        aria-hidden="true"
      />

      {/* ── Capa azul casi transparente que abarca TODO el hero ── */}
      <div
        className="absolute inset-0 pointer-events-none z-[3]"
        data-hero="blue-veil"
        aria-hidden="true"
        style={{
          background: [
            'radial-gradient(95% 75% at 50% 0%, rgba(17,108,146,0.14) 0%, rgba(17,108,146,0.03) 46%, transparent 72%)',
            'linear-gradient(180deg, rgba(158,207,231,0.10) 0%, rgba(23,117,157,0.05) 48%, rgba(7,50,74,0.12) 100%)',
          ].join(', '),
        }}
      />

      {/* ── Neurón real (wrapper animado por GSAP) ───────────── */}
      <HeroRobot
        ref={robotWrapRef}
        top={isMobile ? HERO_RESPONSIVE.mobileTop : HERO_ROBOT.top}
        scale={isMobile ? HERO_RESPONSIVE.mobileRobotScale : HERO_ROBOT.scale}
      />

      {/* Halo monocromo sutil tras Neurón */}
      <div
        className="hero-robot-halo pointer-events-none absolute left-1/2 z-[5]"
        style={{
          top: `${isMobile ? HERO_RESPONSIVE.mobileTop : HERO_ROBOT.top}%`,
          width: 'min(78vw, 720px)',
          height: 'min(78vw, 720px)',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(214,217,224,0.22) 0%, rgba(214,217,224,0.06) 46%, rgba(214,217,224,0) 70%)',
          filter: 'blur(8px)',
        }}
        aria-hidden="true"
      />

      {/* Fade inferior */}
      <div
        ref={fadeRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[6]"
        style={{ height: '30vh', background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.9) 70%, #ffffff)' }}
        data-hero="bottom-fade"
        aria-hidden="true"
      />

      {/* ── Campo de nodos sutiles ───────────────────────────── */}
      <div
        ref={nodesRef}
        className="absolute inset-0"
        data-hero="nodes"
        aria-hidden="true"
      >
        <NeuronField mouseX={mouse.x} mouseY={mouse.y} />
      </div>

      {/* ── Contenido del hero ───────────────────────────────── */}
      <div className="absolute inset-x-0 top-0 z-20 flex flex-col items-center px-6 pt-10 sm:pt-12 text-center"
        style={{ pointerEvents: 'none' }}>
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden="true" className="block h-px w-8 sm:w-12"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(10,11,16,0.35))' }} />
          <span
            className="hero-eyebrow inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.32em]"
            style={{
              color: '#2a2a2a',
              borderColor: 'rgba(10,11,16,0.16)',
              background: 'rgba(255,255,255,0.5)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            <span className="hero-live-dot h-1.5 w-1.5 rounded-full bg-neutral-900" aria-hidden="true" />
            {HERO_COPY.eyebrow}
          </span>
          <span aria-hidden="true" className="block h-px w-8 sm:w-12"
            style={{ background: 'linear-gradient(270deg, transparent, rgba(10,11,16,0.35))' }} />
        </div>

        <h1
          ref={brandRef}
          className="font-black uppercase text-[#0c0d10]"
          data-hero="brand"
          style={{
            fontSize: 'clamp(34px, 6.5vw, 72px)',
            lineHeight: 1,
            letterSpacing: '0.16em',
            textShadow: '0 2px 24px rgba(255,255,255,0.55)',
          }}
        >
          {HERO_BRAND}
        </h1>
        <span
          aria-hidden="true"
          className="hero-brand-rule mt-2 block h-px w-16 sm:w-24"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(10,11,16,0.5), transparent)' }}
        />

        <div className="mt-4 max-w-3xl">
          <h2
            ref={headlineRef}
            className="font-bold text-[#111] leading-tight tracking-tight"
            style={{
              fontSize: 'clamp(22px, 3.4vw, 44px)',
              textShadow: '0 2px 16px rgba(255,255,255,0.5)',
            }}
          >
            {HERO_COPY.headlineA}<br />
            <span
              className="hero-headline-em font-extrabold"
              style={{
                backgroundImage: 'linear-gradient(92deg, #3b3b3f 0%, #0c0d10 60%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {HERO_COPY.headlineB}
            </span>
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
        <div ref={ctaRef} className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
          style={{ pointerEvents: 'auto' }}>
          <a
            href="#capacidades"
            className="hero-cta hero-cta-primary group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full px-7 py-3 text-[15px] font-semibold text-white transition-none"
            style={{ background: '#0c0d10' }}
          >
            <span className="hero-cta-shine" aria-hidden="true" />
            {HERO_COPY.ctaPrimary}
            <span aria-hidden="true" className="hero-cta-arrow">→</span>
          </a>
          <a
            href="#analisis"
            className="hero-cta hero-cta-secondary group inline-flex items-center gap-2.5 rounded-full border px-7 py-3 text-[15px] font-semibold transition-none"
            style={{ borderColor: '#0c0d10', color: '#0c0d10', backgroundColor: 'rgba(255,255,255,0.6)' }}
          >
            {HERO_COPY.ctaSecondary}
            <span aria-hidden="true" className="hero-cta-arrow opacity-60">↗</span>
          </a>
        </div>

        {/* Indicador de scroll */}
        <div
          ref={scrollHintRef}
          className="mt-8 flex flex-col items-center gap-2.5"
          data-hero="scroll-hint"
        >
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#8b8a86]">
            Desliza para entrar
          </span>
          <span
            className="flex h-8 w-5 items-start justify-center rounded-full border p-1"
            style={{ borderColor: 'rgba(10,11,16,0.35)', background: 'rgba(255,255,255,0.35)' }}
          >
            <span className="hero-scroll-dot h-1.5 w-1.5 rounded-full bg-neutral-900" />
          </span>
        </div>
      </div>
    </section>
  );
}