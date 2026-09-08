/**
 * LandingPage.tsx — Landing de NeuroLearn (rewrite)
 * ─────────────────────────────────────────────────────────────
 * Landing completa, futurista y monocroma (negro/blanco/gris/azul).
 * MANTIENE el Hero anterior (cinematográfico editorial con el robot
 * 3D) y añade el viaje de Neuron: un Neuron que se "transporta"
 * siguiendo la sección activa mientras el usuario baja o sube.
 *
 * Story-board:
 *   · 00 Hero (Neuron despierta) — Hero anterior conservado
 *   · 01 Neuron analiza
 *   · 02 Cinco competencias (red neuronal)
 *   · 03 Pipeline Datos → Aprendizaje
 *   · 04 NeuroChat / NeuroTutor
 *   · 05 Plataforma estudiantes/docentes
 *   · 06 Integración y automatización
 *   · 07 CTA final (Neuron vuelve) · 08 Footer
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect } from 'react';
import Lenis from 'lenis';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './landing.css';
import LandingNavbar from './components/LandingNavbar';
import Hero from './components/Hero';
import SectionAnalyze from './components/SectionAnalyze';
import SectionCapabilities from './components/SectionCapabilities';
import SectionPipeline from './components/SectionPipeline';
import SectionChatTutor from './components/SectionChatTutor';
import SectionPlatform from './components/SectionPlatform';
import SectionIntegration from './components/SectionIntegration';
import SectionFinalCTA from './components/SectionFinalCTA';
import LandingFooter from './components/LandingFooter';
import useCustomCursor from './hooks/useCustomCursor';
import TravellingNeuron, { type NeuronStop } from './components/TravellingNeuron';

const NEURON_STOPS: NeuronStop[] = [
  { id: 'hero',        label: 'Neuron despierta' },
  { id: 'analisis',    label: 'Analiza' },
  { id: 'capacidades', label: 'Competencias' },
  { id: 'podemos',     label: 'Proceso' },
  { id: 'chattutor',   label: 'NeuroTutor' },
  { id: 'plataforma',  label: 'Plataforma' },
  { id: 'integracion', label: 'Integración' },
  { id: 'cta',         label: 'Contigo' },
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
        <SectionAnalyze />
        <SectionCapabilities />
        <SectionPipeline />
        <SectionChatTutor />
        <SectionPlatform />
        <SectionIntegration />
        <SectionFinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}