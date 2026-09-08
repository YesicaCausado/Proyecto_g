/**
 * SectionIntegration.tsx — Sección 7 · "Integración y automatización"
 * ─────────────────────────────────────────────────────────────
 * Light. Conexiones visuales entre los elementos del ecosistema:
 * centros de integración (plataforma/automatización) conectados a
 * un hub Neuron. Estética tipo diagrama técnico limpio.
 * ─────────────────────────────────────────────────────────────
 */
import {
  Fingerprint, PanelLeft, CalendarDays, Webhook, Code2, FileBarChart,
  type LucideIcon,
} from 'lucide-react';

import SectionHeading from './SectionHeading';
import NeuronGlyph from './NeuronGlyph';
import useGsapReveal from '../hooks/useGsapReveal';
import { INTEGRATIONS, NL } from '../config/landing.config';

const ICONS: Record<string, LucideIcon> = {
  Fingerprint, PanelLeft, CalendarDays, Webhook, Code2, FileBarChart,
};

export default function SectionIntegration() {
  const scopeRef = useGsapReveal();

  return (
    <section
      ref={scopeRef}
      className="nl-section nl-bg-light relative overflow-hidden"
      aria-label="Integración y automatización"
      id="integracion"
    >
      <div className="nl-container">
        <SectionHeading
          eyebrow="06 · Ecosistema"
          title="Automatización que"
          highlight="se conecta contigo."
          lead="NeuroLearn se integra con tus herramientas y automatiza el flujo de trabajo para que tú te enfoques en enseñar."
          onLight
          center
        />

        {/* Diagrama de integración */}
        <div className="relative mx-auto mt-16 max-w-3xl">
          {/* Hub central Neuron */}
          <div className="relative z-2 mx-auto w-fit">
            <NeuronGlyph size={150} active />
          </div>

          {/* Conectores + pills */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
            {INTEGRATIONS.map((it) => {
              const Icon = ICONS[it.icon] ?? Code2;
              return (
                <div key={it.id} className="flex flex-col items-center gap-2" data-cursor>
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-300 hover:-translate-y-1"
                    style={{
                      borderColor: 'rgba(37,99,235,0.2)',
                      background: 'rgba(37,99,235,0.05)',
                      color: NL.blue,
                      boxShadow: '0 8px 26px -14px rgba(37,99,235,0.3)',
                    }}
                  >
                    <Icon size={26} strokeWidth={1.5} />
                  </div>
                  <span className="nl-mono text-[11px] font-medium text-neutral-600">{it.label}</span>
                  <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: it.kind === 'Automatización' ? NL.blueBright : NL.grayLight }}>{it.kind}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}