/**
 * SectionHeading.tsx
 * ─────────────────────────────────────────────────────────────
 * Cabecera editorial reutilizable para todas las secciones de la
 * Landing: eyebrow técnico + título grande + lead. Se anima con
 * la clase .nl-reveal (GSAP reveal del scope).
 * ─────────────────────────────────────────────────────────────
 */
import { NL } from '../config/landing.config';

interface Props {
  eyebrow: string;
  title:  string;
  highlight?: string;
  lead?:   string;
  /** ¿título en fondo claro (negro) u oscuro (blanco)? */
  onLight?: boolean;
  center?: boolean;
}

export default function SectionHeading({
  eyebrow,
  title,
  highlight,
  lead,
  onLight = false,
  center = false,
}: Props) {
  const align: React.CSSProperties = center ? { textAlign: 'center', margin: '0 auto' } : {};
  const accent = onLight ? NL.blue : NL.blueBright;

  return (
    <div className={`${center ? 'mx-auto' : ''} max-w-[700px]`} style={align}>
      <p className="nl-kicker nl-reveal" style={{ color: accent }}>
        <span className="nl-dot-live" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2
        className="nl-h nl-reveal"
        style={{
          fontSize: 'clamp(28px, 4.2vw, 48px)',
          lineHeight: 1.1,
          marginTop: 16,
          color: onLight ? NL.black : '#fff',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
        {highlight && <span style={{ color: accent }}> {highlight}</span>}
      </h2>
      {lead && (
        <p
          className="nl-reveal"
          style={{
            marginTop: 18,
            fontSize: '17px',
            lineHeight: 1.65,
            color: onLight ? NL.grayMid : '#B8B8B8',
          }}
        >
          {lead}
        </p>
      )}
    </div>
  );
}