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
 *   · Scroll nativo del navegador (rueda, touchpad y barra). Antes se
 *     usaba Lenis, pero su bucle de animación se detenía tras el
 *     primer cuadro y la rueda del ratón dejaba de desplazar la página.
 *   · La sección de patrones se pinnea y recorre horizontalmente
 *     los 5 patrones neurodigitales (GSAP + ScrollTrigger).
 *   · props: reutiliza Hero (Neuron 3D), NeuronGlyph, TravellingNeuron,
 *     useCustomCursor y respeta prefers-reduced-motion.
 * ─────────────────────────────────────────────────────────────
 */
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