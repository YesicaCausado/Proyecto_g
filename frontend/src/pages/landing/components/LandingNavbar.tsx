/**
 * LandingNavbar.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: barra de navegación mínima y limpia de
 * la Landing. Monocromo (blanco/negro/gris), sin dependencias.
 * ─────────────────────────────────────────────────────────────
 */
import { HERO_BRAND } from '../config/hero.config';

export default function LandingNavbar() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        background: 'rgba(255,255,255,0.55)',
      }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        {/* Marca */}
        <a href="#" className="flex items-center gap-2" aria-label="Ir arriba">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-white"
            style={{ background: '#0c0d10', fontSize: '13px', fontWeight: 700 }}
            aria-hidden="true"
          >
            N
          </span>
          <span className="text-sm font-bold tracking-widest text-neutral-900">
            {HERO_BRAND}
          </span>
        </a>

        {/* Acciones */}
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="#patrones"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:text-black sm:inline-flex"
          >
            Patrones
          </a>
          <a
            href="/login"
            className="hero-cta hero-cta-primary inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold text-white"
            style={{ background: '#0c0d10' }}
          >
            Entrar
          </a>
        </div>
      </nav>
    </header>
  );
}