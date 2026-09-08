/**
 * HeroRobot.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: montar a Neurón (el /robot.glb real)
 * dentro del Hero y exponer contenedores DOM separados para que
 * GSAP los anime SIN conflictos entre sí:
 *
 *   · wrapper  → transform de ENTRADA + SCROLL + MOUSE
 *                 (GSAP anima y/scale/rotation sobre este div)
 *   · float    → transform de FLOTACIÓN continua
 *                 (GSAP anima SOLO y sobre este div interno)
 *
 * Al dividir los targets, una animación infinita (float) nunca
 * pisa a la transición (scroll), porque cada una escribe en un
 * elemento distinto del árbol.
 *
 * Neurón se reutiliza por completo: RobotCanvas (robotState="idle")
 * renderiza el /robot.glb real con su motor de respiración,
 * parpadeo y mirada al usuario — seguimos sin tocar ese motor.
 *
 * Palette: se inyecta HERO_LIGHTING.preset (luces blancas/grises)
 * para que Neurón mantenga la estética estrictamente monocroma del
 * Hero, sin alterar la escena azul/violeta del login.
 * ─────────────────────────────────────────────────────────────
 */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import RobotCanvas from '../../auth/components/robot/RobotCanvas';
import { HERO_LIGHTING } from '../config/hero.config';

export interface HeroRobotHandle {
  /** Contenedor externo — lo anima GSAP en entrada / scroll / mouse */
  wrapper: HTMLDivElement | null;
  /** Contenedor interno — lo anima GSAP en la flotación continua */
  float:   HTMLDivElement | null;
}

interface HeroRobotProps {
  /** Posicionamiento del robot dentro del hero */
  top:    number;
  scale:  number;
  /** Para desactivar efectos en modo reducido o móvil */
  reduceMotion: boolean;
  isMobile: boolean;
}

const HeroRobot = forwardRef<HeroRobotHandle, HeroRobotProps>(
  function HeroRobot({ top, scale, reduceMotion, isMobile }, ref) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const floatRef   = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      get wrapper() { return wrapperRef.current; },
      get float()   { return floatRef.current; },
    }), []);

    return (
      <div
        ref={wrapperRef}
        aria-hidden="true"
        className="hero-robot pointer-events-none select-none"
        style={{
          position: 'absolute',
          top: `${top}%`,
          left: '50%',
          width: '100%',
          height: '72vh',
          transform: `translate(-50%, -50%) scale(${scale})`,
          willChange: 'transform, opacity',
        }}
      >
        {/* Capa interna de flotación — la única que recibe el bob */}
        <div
          ref={floatRef}
          className="relative w-full h-full"
          style={{ willChange: 'transform' }}
        >
          <RobotCanvas
            robotState="idle"
            transparent
            className="w-full h-full"
            lightingPresets={HERO_LIGHTING.preset}
          />
          
          {/* Ojos brillantes - efecto de brillo progresivo */}
          {!reduceMotion && !isMobile && (
            <div className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 30% 35%, rgba(0,255,100,0.15) 0%, transparent 40%),
                  radial-gradient(circle at 70% 35%, rgba(0,255,100,0.15) 0%, transparent 40%)
                `,
                pointerEvents: 'none'
              }}
            />
          )}
        </div>
      </div>
    );
  },
);

export default HeroRobot;