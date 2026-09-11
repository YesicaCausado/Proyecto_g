/**
 * Neuron3D.tsx
 * ─────────────────────────────────────────────────────────────
 * Envuelve el robot 3D real (RobotCanvas + /robot.glb) para la
 * Landing con iluminación MONOCROMA + acento azul. Reutiliza por
 * completo el motor 3D existente; solo inyecta presets de luces
 * y efectos. En móvil se sustituye por NeuronGlyph (2D) para
 * rendimiento.
 *
 * Expone refs DOM para que GSAP anime wrapper (entrada / scroll)
 * y float (levitación) por separado.
 * ─────────────────────────────────────────────────────────────
 */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import RobotCanvas from '../../auth/components/robot/RobotCanvas';
import NeuronGlyph from './NeuronGlyph';

export interface Neuron3DHandle {
  wrapper: HTMLDivElement | null;
  float:   HTMLDivElement | null;
}

interface Props {
  top?: number;
  scale: number;
  use3D: boolean;
}

const Neuron3D = forwardRef<Neuron3DHandle, Props>(
  function Neuron3D({ top, scale, use3D }, ref) {
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
        className="neuron3d pointer-events-none select-none"
        style={{
          position: 'absolute',
          top: top ? `${top}%` : '50%',
          left: '50%',
          width: '100%',
          height: '80vh',
          transform: `translate(-50%, -50%) scale(${scale})`,
          willChange: 'transform, opacity',
        }}
      >
        <div ref={floatRef} className="relative h-full w-full" style={{ willChange: 'transform' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            {use3D ? (
              <RobotCanvas
                robotState="idle"
                transparent
                className="h-full w-full"
              />
            ) : (
              <NeuronGlyph size={Math.min(window.innerWidth * 0.72, 360)} active />
            )}
          </div>
        </div>
      </div>
    );
  },
);

export default Neuron3D;