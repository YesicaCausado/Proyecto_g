/**
 * SectionBenefits.tsx — Sección "Beneficios"
 * ─────────────────────────────────────────────────────────────
 * Tarjetas minimalistas (no genéricas): cada una entra desde una
 * dirección distinta (GSAP) y tiene microinteracción de elevación.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sparkles, Activity, Brain, Users, type LucideIcon } from 'lucide-react';

import { BENEFITS, NL } from '../config/landing.config';

gsap.registerPlugin(ScrollTrigger);

const ICONS: Record<string, LucideIcon> = { Sparkles, Activity, Brain, Users };

const FROM_DIR: Record<string, { x: number; y: number }> = {
  left:   { x: -48, y: 0 },
  right:  { x: 48,  y: 0 },
  top:    { x: 0,   y: -48 },
  bottom: { x: 0,   y: 48 },
};

export default function SectionBenefits() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cards = section.querySelectorAll<HTMLElement>('[data-benefit]');
    if (!cards.length) return;

    if (reduce) {
      gsap.set(cards, { opacity: 1, x: 0, y: 0 });
      return;
    }

    gsap.set(section.querySelectorAll('[data-benefit-head]'), { opacity: 0, y: 28 });

    const headTl = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top 72%', toggleActions: 'play none none none' },
      defaults: { ease: 'power3.out', duration: 0.8 },
    });
    headTl.to(section.querySelectorAll('[data-benefit-head]'), { opacity: 1, y: 0, stagger: 0.1 });

    cards.forEach((card) => {
      const dir = FROM_DIR[card.dataset.dir ?? 'top'] ?? FROM_DIR.top;
      gsap.fromTo(card, { opacity: 0, x: dir.x, y: dir.y }, {
        opacity: 1, x: 0, y: 0, duration: 0.85, ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 88%', toggleActions: 'play none none none' },
      });
    });

    return () => {
      headTl.scrollTrigger?.kill();
      headTl.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="beneficios"
      className="nl-section nl-bg-light relative overflow-hidden"
      aria-label="Beneficios de NeuroLearn"
    >
      <div className="nl-container">
        <div className="mx-auto max-w-2xl text-center">
          <p data-benefit-head className="nl-kicker" style={{ color: NL.blue }}>
            <span className="nl-dot-live" aria-hidden="true" />
            Beneficios
          </p>
          <h2
            data-benefit-head
            className="nl-h mt-5"
            style={{ fontSize: 'clamp(30px, 4.4vw, 52px)', lineHeight: 1.05, letterSpacing: '-0.02em', color: '#0a0a0a' }}
          >
            Una experiencia que <span style={{ color: NL.blue }}>se adapta.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {BENEFITS.map((b) => {
            const Icon = ICONS[b.icon] ?? Sparkles;
            return (
              <div
                key={b.id}
                data-benefit
                data-dir={b.from}
                className="group relative overflow-hidden rounded-2xl border bg-white p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-[0_30px_70px_-30px_rgba(37,99,235,0.35)]"
                style={{ borderColor: 'rgba(5,5,5,0.08)' }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 flex-none items-center justify-center rounded-xl transition-all duration-300 group-hover:bg-blue-600"
                    style={{ background: 'rgba(37,99,235,0.1)', color: NL.blue }}
                  >
                    <Icon size={22} strokeWidth={1.7} />
                  </div>
                  <h3 className="nl-h text-[17px] font-semibold text-neutral-800">{b.title}</h3>
                </div>
                <p className="mt-4 text-[14.5px] leading-relaxed text-neutral-500">{b.desc}</p>
                {/* filete técnico que crece en hover */}
                <span
                  className="absolute bottom-0 left-0 h-px w-0 bg-blue-500 transition-all duration-500 group-hover:w-full"
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}