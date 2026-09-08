/**
 * LandingFooter.tsx
 * ─────────────────────────────────────────────────────────────
 * Pie de la Landing: marca + columnas de enlaces + línea legal.
 * Estrictamente monocromo + azul.
 * ─────────────────────────────────────────────────────────────
 */
import { FOOTER_LINKS, NL } from '../config/landing.config';

export default function LandingFooter() {
  return (
    <footer
      className="nl-bg-black-2"
      style={{ color: '#A3A3A3', padding: '64px clamp(20px,6vw,72px) 36px', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white" style={{ background: `linear-gradient(135deg, ${NL.blue}, ${NL.blueBright})` }} aria-hidden="true">N</span>
              <span className="nl-h text-[17px] font-semibold text-white">NeuroLearn<span style={{ color: NL.blueSoft }}>.</span></span>
            </div>
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-neutral-500">
              La plataforma donde la inteligencia artificial entiende cómo aprende cada estudiante.
            </p>
          </div>

          <FooterCol title="Producto" links={FOOTER_LINKS.producto} />
          <FooterCol title="Saberes" links={FOOTER_LINKS.saberes} />
          <FooterCol title="Empresa" links={FOOTER_LINKS.empresa} />
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <span className="nl-mono text-[11px] tracking-wide text-neutral-600">© {new Date().getFullYear()} NeuroLearn. Aprendizaje adaptativo.</span>
          <span className="flex items-center gap-5">
            <span className="nl-mono text-[11px] text-neutral-600">IA + Educación</span>
            <span className="nl-dot-live" aria-hidden="true" />
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: readonly string[] }) {
  return (
    <div>
      <h4 className="nl-mono text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: NL.grayLight }}>{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l}>
            <a href="#" className="text-[13.5px] text-neutral-400 transition-colors hover:text-white">{l}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}