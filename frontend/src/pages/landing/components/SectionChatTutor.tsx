/**
 * SectionChatTutor.tsx — Sección 5 · "NeuroChat / NeuroTutor"
 * ─────────────────────────────────────────────────────────────
 * Light. El usuario siente que habla con una IA real: ventana de
 * chat con Neuron, mensajes animados y escritura en vivo. Contenido
 * a la izquierda, ventana de chat a la derecha.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

import SectionHeading from './SectionHeading';
import NeuronGlyph from './NeuronGlyph';
import useGsapReveal from '../hooks/useGsapReveal';
import { NL } from '../config/landing.config';

const CONVERSATION = [
  { who: 'user', text: 'No entiendo el límite por factorización…' },
  { who: 'bot', text: 'Es normal, ese concepto exige un paso intermedio. Vamos por partes: ¿qué es un límite para ti?' },
  { who: 'user', text: '¿A dónde tiende una función?' },
  { who: 'bot', text: 'Exacto. Ahora, cuando algo “tiende”, podemos aproximarlo. Confía en ese puente y verás la factorización.' },
];

export default function SectionChatTutor() {
  const scopeRef = useGsapReveal();
  const msgList = useRef<HTMLDivElement>(null);
  const [showTyping, setShowTyping] = useState(false);

  // Escritura en vivo + mensajes escalonados
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const list = msgList.current;
    if (!list) return;

    const ctx = gsap.context(() => {
      const msgs = list.querySelectorAll('[data-msg]');
      gsap.fromTo(msgs, { opacity: 0, y: 18, scale: 0.97 }, {
        opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power2.out', stagger: 0.7,
        scrollTrigger: { trigger: list, start: 'top 78%', toggleActions: 'play none none none' },
        onComplete: () => {
          // Mostrar indicador de escritura tras los mensajes
          setShowTyping(true);
          setTimeout(() => setShowTyping(false), 1500);
        },
      });
    }, list);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={scopeRef}
      className="nl-section nl-bg-light relative overflow-hidden"
      aria-label="NeuroChat, el tutor de inteligencia artificial"
      id="chattutor"
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${NL.blueSoft}55, transparent)` }} />

      <div className="nl-container grid items-center gap-14 lg:grid-cols-2">
        {/* Texto */}
        <div>
          <SectionHeading
            eyebrow="04 · NeuroTutor"
            title="Habla con una IA que"
            highlight="te conoce."
            lead="NeuroChat entiende el momento exacto de tu duda y adapta la explicación a tu ritmo. No responde genérico: responde a tu forma de aprender."
            onLight
          />
          {/* Mini feature pills */}
          <div className="mt-8 flex flex-wrap gap-3">
            {['Disponible 24/7', 'Explica a tu ritmo', 'Detecta dudas reales'].map((p) => (
              <span key={p} className="nl-mono inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium" style={{ borderColor: 'rgba(37,99,235,0.2)', color: NL.blue, background: 'rgba(37,99,235,0.04)' }}>
                <span className="nl-dot-live" style={{ transform: 'scale(0.6)' }} />
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Ventana de chat */}
        <div className="relative">
          <div
            className="nl-card-light rounded-3xl p-4"
            style={{ background: '#fff', border: '1px solid rgba(5,5,5,0.08)', boxShadow: '0 40px 120px -50px rgba(0,0,0,0.4)', overflow: 'hidden' }}
          >
            {/* Header del chat */}
            <div className="flex items-center gap-3 border-b px-2 pb-4" style={{ borderColor: 'rgba(5,5,5,0.06)' }}>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <NeuronGlyph size={38} active />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-800">Neuron</div>
                  <div className="text-[11px]" style={{ color: NL.blue }}>● Tutor IA · en línea</div>
                </div>
              </div>
            </div>

            {/* Mensajes */}
            <div ref={msgList} className="flex flex-col gap-3 px-1 py-6">
              {CONVERSATION.map((m, i) => (
                <div
                  key={i}
                  data-msg
                  className={m.who === 'bot' ? 'nl-msg nl-msg-bot' : 'nl-msg nl-msg-user'}
                  style={{ maxWidth: '80%' }}
                >
                  {m.text}
                </div>
              ))}
              {showTyping && (
                <div className="nl-msg nl-msg-bot" style={{ maxWidth: '80%' }}>
                  <span className="nl-tb-typing"><span /><span /><span /></span>
                </div>
              )}
            </div>
          </div>

          {/* Blob azul decorative */}
          <div aria-hidden="true" className="absolute -right-6 -top-8 h-40 w-40 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.16), transparent 65%)', filter: 'blur(6px)' }} />
        </div>
      </div>
    </section>
  );
}