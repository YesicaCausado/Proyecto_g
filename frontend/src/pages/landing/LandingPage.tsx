/**
 * LandingPage.tsx — Landing de NeuroLearn (narrativa por scroll)
 * ─────────────────────────────────────────────────────────────
 * Landing completa, minimalista, futurista y monocroma
 * (negro/blanco/gris/azul). Cuenta una HISTORIA mediante el scroll:
 *
 *   HERO → ¿Qué es NeuroLearn? → Patrones (recorrido horizontal
 *   pinneado) → Personalización → Beneficios → Instituciones →
 *   CTA final → Footer
 *
 * Técnica:
 *   · Lenis (smooth scroll) sincronizado con ScrollTrigger.
 *   · La sección de patrones se pinnea y recorre horizontalmente
 *     los 5 patrones neurodigitales (GSAP + ScrollTrigger).
 *   · props: reutiliza Hero (Neuron 3D), NeuronGlyph, TravellingNeuron,
 *     useCustomCursor y respeta prefers-reduced-motion.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect } from 'react';
import Lenis from 'lenis';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './landing.css';
import LandingNavbar from './components/LandingNavbar';
import Hero from './components/Hero';
import SectionWhatIs from './components/SectionWhatIs';
import PatternHorizontalPinned from './components/PatternHorizontalPinned';
import SectionPersonalization from './components/SectionPersonalization';
import SectionBenefits from './components/SectionBenefits';
import SectionInstitutions from './components/SectionInstitutions';
import SectionFinalCTA from './components/SectionFinalCTA';
import LandingFooter from './components/LandingFooter';
import useCustomCursor from './hooks/useCustomCursor';
import TravellingNeuron, { type NeuronStop } from './components/TravellingNeuron';

const NEURON_STOPS: NeuronStop[] = [
  { id: 'hero',            label: 'Neuron despierta' },
  { id: 'que-es',          label: 'NeuroLearn' },
  { id: 'patrones',        label: 'Patrones' },
  { id: 'personalizacion', label: 'Personalización' },
  { id: 'beneficios',      label: 'Beneficios' },
  { id: 'instituciones',   label: 'Instituciones' },
  { id: 'cta',             label: 'Contigo' },
];

export default function LandingPage() {
  const cursor = useCustomCursor();

  // Smooth scroll (Lenis) + sincronización con ScrollTrigger.
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    const raf = (time: number) => lenis.raf(time);
    lenis.on('scroll', ScrollTrigger.update);
    const rafId = requestAnimationFrame(raf);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__lenis = lenis;

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__lenis;
    };
  }, []);

  return (
    <div className="nl-app">
      {cursor}
      <LandingNavbar />
      <TravellingNeuron stops={NEURON_STOPS} />
      <main>
        <Hero />
        <SectionWhatIs />
        <PatternHorizontalPinned />
        <SectionPersonalization />
        <SectionBenefits />
        <SectionInstitutions />
        <SectionFinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}