/**
 * SectionPlatform.tsx — Sección 6 · "Plataforma estudiantes/docentes"
 * ─────────────────────────────────────────────────────────────
 * Dark intermedio. Tarjetas minimalistas tipo dashboard para
 * estudiantes y docentes. Cada card es interactiva (elevación +
 * glow azul al hover).
 * ─────────────────────────────────────────────────────────────
 */
import { useRef } from 'react';
import {
  MessageSquare, Activity, LayoutDashboard, BarChart3, FileText, Users,
  type LucideIcon,
} from 'lucide-react';

import SectionHeading from './SectionHeading';
import useGsapReveal from '../hooks/useGsapReveal';
import { NL, PLATFORM_CARDS } from '../config/landing.config';

const ICONS: Record<string, LucideIcon> = {
  MessageSquare, Activity, LayoutDashboard, BarChart3, FileText, Users,
};

export default function SectionPlatform() {
  const scopeRef = useGsapReveal();
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <section
      ref={scopeRef}
      className="nl-section nl-bg-dark relative overflow-hidden"
      aria-label="Plataforma para estudiantes y docentes"
      id="plataforma"
    >
      <div aria-hidden="true" className="absolute inset-0" style={{
        background: 'radial-gradient(90% 60% at 50% 0%, rgba(37,99,235,0.08), transparent 70%)',
      }} />
      <div className="nl-container">
        <SectionHeading
          eyebrow="05 · Plataforma"
          title="Para estudiantes y"
          highlight="docentes."
          lead="La misma inteligencia, dos experiencias: dashboards claros, contenido adaptativo y seguimiento preciso del progreso — sin fricción."
        />

        {/* Selector de audiencia */}
        <div ref={gridRef} className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_CARDS.map((c) => {
            const Icon = ICONS[c.icon] ?? LayoutDashboard;
            return (
              <div key={c.id} className="nl-card nl-reveal group" data-cursor style={{ padding: '26px 24px', borderRadius: 18 }}>
                {/* Tag */}
                <span className="nl-mono inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ background: `${NL.blue}18`, color: NL.blueSoft }}>
                  {c.tag}
                </span>

                <div className="mt-6 flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:bg-blue-600"
                    style={{ background: 'rgba(37,99,235,0.12)', color: NL.blueBright, transition: 'all .3s ease' }}
                  >
                    <Icon size={22} strokeWidth={1.6} />
                  </div>
                  <h3 className="nl-h text-lg text-white">{c.title}</h3>
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-neutral-400">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}