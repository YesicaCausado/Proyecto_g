/**
 * SectionCapabilities.tsx — Sección 3 · "Cinco saberes"
 * ─────────────────────────────────────────────────────────────
 * Light (contraste). Las 5 competencias aparecen como nodos
 * conectados a una red neuronal central (Neuron). Interactivos:
 * al hover el nodo se ilumina azul y se eleva.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from 'react';

import SectionHeading from './SectionHeading';
import NeuronGlyph from './NeuronGlyph';
import { COMPETENCIES, NL, RESPONSIVE } from '../config/landing.config';
import useGsapReveal from '../hooks/useGsapReveal';

export default function SectionCapabilities() {
  const scopeRef = useGsapReveal();
  const [isMobile, setMobile] = useState(false);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < RESPONSIVE.mobileBreakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <section
      ref={scopeRef}
      className="nl-section nl-bg-pale relative overflow-hidden"
      aria-label="Los cinco saberes conectados a una red neuronal"
      id="capacidades"
    >
      <div className="nl-container">
        <SectionHeading
          eyebrow="02 · Competencias del Saber 11"
          title="Cinco saberes,"
          highlight="una sola IA."
          lead="NeuroLearn trabaja las cinco competencias que evalúa el Saber 11 como una única red neuronal conectada: cada señal alimenta a las demás."
          onLight
          center
        />

        {/* Red neuronal de competencias */}
        <div
          className="relative mx-auto mt-16"
          style={{
            maxWidth: isMobile ? 420 : 860,
            height: isMobile ? 560 : 460,
          }}
        >
          {/* Neuron central */}
          <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)' }}>
            <NeuronGlyph size={isMobile ? 150 : 190} active />
          </div>

          {/* Conexiones SVG de fondo */}
          <svg
            className="absolute inset-0 hidden sm:block"
            width="100%" height="100%"
            style={{ opacity: 0.5 }}
            aria-hidden="true"
          >
            {COMPETENCIES.map((c, i) => {
              const ang = (i / COMPETENCIES.length) * Math.PI * 2 - Math.PI / 2;
              const rx = 860 / 2, ry = 460 / 2;
              const x = rx + Math.cos(ang) * (rx - 78);
              const y = ry + Math.sin(ang) * (ry - 70);
              return (
                <g key={c.id}>
                  <line x1={rx} y1={ry} x2={x} y2={y} stroke="#2563EB" strokeWidth="1" strokeOpacity="0.45" strokeDasharray="3 4" />
                  <circle cx={x} cy={y} r="2.5" fill="#3B82F6" />
                </g>
              );
            })}
          </svg>

          {/* Nodos de competencia */}
          {COMPETENCIES.map((c, i) => {
            const pos = [
              { top: '6%',  left: '6%'  },
              { top: '6%',  left: '70%' },
              { top: '84%', left: '16%' },
              { top: '84%', left: '64%' },
              { top: '46%', left: '38%' },
            ][i];
            return (
              <div
                key={c.id}
                className="nl-card nl-card-light nl-reveal group"
                data-cursor
                style={{
                  position: isMobile ? 'static' : 'absolute',
                  top: isMobile ? 'auto' : pos.top,
                  left: isMobile ? 'auto' : pos.left,
                  width: isMobile ? '100%' : 240,
                  padding: '20px 22px',
                  borderRadius: 16,
                  marginBottom: isMobile ? 16 : 0,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="nl-mono flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors duration-300 group-hover:text-white"
                    style={{ background: isMobile ? NL.blue : 'rgba(37,99,235,0.12)', color: NL.blue, transition: 'background .3s ease' }}
                  >
                    {c.index}
                  </span>
                  <h3 className="nl-h text-[16px] font-semibold text-neutral-800">
                    {c.label}
                  </h3>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-500">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}