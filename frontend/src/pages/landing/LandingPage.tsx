/**
 * LandingPage.tsx
 * ─────────────────────────────────────────────────────────────
 * Página pública de aterrizaje de NeuroLearn.
 *
 * Por ahora contiene SOLO:
 *   1. Navbar minimalista (marca + "Entrar").
 *   2. Hero a pantalla completa con Neurón real + GSAP.
 *   3. Transición hacia la sección de los 5 patrones
 *      neurodigitales (sin desarrollarla aún).
 *
 * Arquitectura: la animación del Hero la maneja internamente
 * Hero.tsx (entrada / flotación / mouse / scroll). Aquí solo se
 * ensambla el layout.
 * ─────────────────────────────────────────────────────────────
 */
import LandingNavbar   from './components/LandingNavbar';
import Hero            from './components/Hero';
import PatternsTransition from './components/PatternsTransition';
import PatternDetails  from './components/PatternDetails';

export default function LandingPage() {
  return (
    <div style={{ background: '#ffffff', color: '#191919' }}>
      <LandingNavbar />
      <main>
        <Hero />
        <PatternsTransition />
        <PatternDetails />
      </main>
    </div>
  );
}