/**
 * NeuroParticles.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: un campo de partículas/efectos 3D LIGERO
 * (React Three Fiber + drei) que envuelve el cierre de la Landing.
 * Usa primitivas estables de drei — <Sparkles> y <Float> — y no
 * toca la escena existente de Neurón (RobotCanvas).
 *
 * Es decorativo (pointer-events: none) y transparente, pensado para
 * colocarse detrás del contenido.
 * ─────────────────────────────────────────────────────────────
 */
import { Canvas } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';

export default function NeuroParticles() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6], fov: 60 }}
      gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      {/* Neodimas teal/azul en dos capas de profundidad */}
      <Sparkles count={80} scale={[7, 5, 2.4]} size={2.4} speed={0.32} opacity={0.6} color="#5DC8B4" />
      <Sparkles count={45} scale={[5.5, 3.5, 2]} size={3.2} speed={0.2} opacity={0.42} color="#3FA9DB" />

      {/* Un pequeño "núcleo" de la paleta flotando (elenco wireframe) */}
      <Float speed={1.4} rotationIntensity={0.35} floatIntensity={0.9}>
        <mesh>
          <tetrahedronGeometry args={[0.38, 0]} />
          <meshStandardMaterial
            color="#A78BFA"
            emissive="#A78BFA"
            emissiveIntensity={0.5}
            wireframe
            transparent
            opacity={0.6}
          />
        </mesh>
      </Float>
    </Canvas>
  );
}