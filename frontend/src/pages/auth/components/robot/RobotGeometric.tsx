/**
 * RobotGeometric.tsx
 * ─────────────────────────────────────────────────────────────
 * Robot 3D construido con primitivas de Three.js.
 * Se usa cuando no hay robot.glb disponible.
 * Animaciones CSS/GSAP-free — usa useFrame de R3F.
 * ─────────────────────────────────────────────────────────────
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import type { RobotState } from './RobotStates';

interface RobotGeometricProps {
  robotState?: RobotState;
  position?:   [number, number, number];
  scale?:      number;
}

// ── Paleta de colores por estado ──────────────────────────────
const STATE_COLOR: Record<RobotState, string> = {
  idle:            '#4f8ef7',
  greeting:        '#0B6E99',
  lookingEmail:    '#0F7B6C',
  lookingPassword: '#6940A5',
  loading:         '#D9730D',
  success:         '#0F7B6C',
  error:           '#E03E3E',
  sleep:           '#787774',
  celebrate:       '#DFAB01',
};

const STATE_EMISSIVE: Record<RobotState, string> = {
  idle:            '#0a1a40',
  greeting:        '#002233',
  lookingEmail:    '#001a15',
  lookingPassword: '#150a30',
  loading:         '#301500',
  success:         '#001a15',
  error:           '#2a0000',
  sleep:           '#111111',
  celebrate:       '#2a1a00',
};

export default function RobotGeometric({
  robotState = 'idle',
  position   = [0, -0.8, 0],
  scale      = 1,
}: RobotGeometricProps) {
  const rootRef   = useRef<Group>(null);
  const headRef   = useRef<Group>(null);
  const bodyRef   = useRef<Group>(null);
  const eyeLRef   = useRef<Mesh>(null);
  const eyeRRef   = useRef<Mesh>(null);
  const armLRef   = useRef<Group>(null);
  const armRRef   = useRef<Group>(null);

  const color    = STATE_COLOR[robotState]   ?? '#4f8ef7';
  const emissive = STATE_EMISSIVE[robotState] ?? '#0a1a40';

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (!rootRef.current || !headRef.current) return;

    // Flotación base del cuerpo
    rootRef.current.position.y = position[1] + Math.sin(t * 1.2) * 0.06;

    // Rotación suave de la cabeza según el estado
    if (headRef.current) {
      if (robotState === 'lookingEmail') {
        headRef.current.rotation.y = Math.sin(t * 0.5) * 0.2 + 0.3;
        headRef.current.rotation.x = -0.15;
      } else if (robotState === 'lookingPassword') {
        headRef.current.rotation.y = Math.sin(t * 0.5) * 0.2 - 0.3;
        headRef.current.rotation.x = -0.2;
      } else if (robotState === 'loading') {
        headRef.current.rotation.y = t * 1.5;
      } else if (robotState === 'sleep') {
        headRef.current.rotation.x = 0.4;
        headRef.current.rotation.y = 0;
      } else if (robotState === 'greeting') {
        headRef.current.rotation.y = Math.sin(t * 2) * 0.3;
      } else {
        headRef.current.rotation.y = Math.sin(t * 0.8) * 0.1;
        headRef.current.rotation.x = 0;
      }
    }

    // Brazos oscilan
    if (armLRef.current) {
      armLRef.current.rotation.z = robotState === 'greeting'
        ? Math.sin(t * 3) * 0.5 + 0.3
        : Math.sin(t * 1.2 + 1) * 0.12 + 0.2;
    }
    if (armRRef.current) {
      armRRef.current.rotation.z = robotState === 'greeting'
        ? Math.sin(t * 3 + Math.PI) * 0.5 - 0.3
        : Math.sin(t * 1.2) * 0.12 - 0.2;
    }

    // Ojos parpadean
    const blink = Math.sin(t * 0.3) > 0.97;
    const eyeScaleY = robotState === 'sleep' ? 0.1 : blink ? 0.05 : 1;
    if (eyeLRef.current) eyeLRef.current.scale.y = eyeScaleY;
    if (eyeRRef.current) eyeRRef.current.scale.y = eyeScaleY;

    // Emissive pulsa en loading/error/success
    if (bodyRef.current && (robotState === 'loading' || robotState === 'success' || robotState === 'error')) {
      const pulse = (Math.sin(t * 4) + 1) / 2;
      bodyRef.current.children.forEach((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh && (mesh.material as any)?.emissiveIntensity !== undefined) {
          (mesh.material as any).emissiveIntensity = 0.3 + pulse * 0.7;
        }
      });
    }
  });

  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={0.4}
      roughness={0.3}
      metalness={0.7}
    />
  );

  const darkMat = (
    <meshStandardMaterial
      color="#1a1a2e"
      emissive="#000010"
      emissiveIntensity={0.2}
      roughness={0.5}
      metalness={0.8}
    />
  );

  return (
    <group ref={rootRef} position={position} scale={scale}>

      {/* ── Torso ─────────────────────────────────────────────── */}
      <group ref={bodyRef} position={[0, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.7, 0.9, 0.45]} />
          {mat}
        </mesh>
        {/* Panel pecho */}
        <mesh position={[0, 0.05, 0.23]}>
          <boxGeometry args={[0.45, 0.5, 0.02]} />
          <meshStandardMaterial color="#0d0d1a" emissive={color} emissiveIntensity={0.6} roughness={0.2} metalness={0.9} />
        </mesh>
        {/* Indicador de estado — línea pulsante */}
        <mesh position={[0, 0.05, 0.245]}>
          <boxGeometry args={[0.3, 0.04, 0.01]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} roughness={0} metalness={1} />
        </mesh>
        {/* Tornillos decorativos */}
        {[[-0.3, 0.35], [0.3, 0.35], [-0.3, -0.35], [0.3, -0.35]].map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.23]}>
            <cylinderGeometry args={[0.025, 0.025, 0.04, 6]} />
            <meshStandardMaterial color="#888" metalness={1} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {/* ── Cuello ────────────────────────────────────────────── */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.12, 8]} />
        {darkMat}
      </mesh>

      {/* ── Cabeza ────────────────────────────────────────────── */}
      <group ref={headRef} position={[0, 0.85, 0]}>
        {/* Cráneo */}
        <mesh castShadow>
          <boxGeometry args={[0.6, 0.52, 0.5]} />
          {mat}
        </mesh>

        {/* Visera frontal */}
        <mesh position={[0, 0.06, 0.24]}>
          <boxGeometry args={[0.5, 0.22, 0.06]} />
          <meshStandardMaterial color="#050510" emissive="#001133" emissiveIntensity={0.8} roughness={0.1} metalness={1} />
        </mesh>

        {/* Ojo izquierdo */}
        <mesh ref={eyeLRef} position={[-0.14, 0.06, 0.28]}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} roughness={0} metalness={0} />
        </mesh>

        {/* Ojo derecho */}
        <mesh ref={eyeRRef} position={[0.14, 0.06, 0.28]}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} roughness={0} metalness={0} />
        </mesh>

        {/* Boca / scanner */}
        <mesh position={[0, -0.14, 0.26]}>
          <boxGeometry args={[0.28, 0.03, 0.02]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} roughness={0} metalness={1} />
        </mesh>

        {/* Antena */}
        <mesh position={[0, 0.33, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.22, 6]} />
          {darkMat}
        </mesh>
        <mesh position={[0, 0.46, 0]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} roughness={0} />
        </mesh>

        {/* Oreja izquierda */}
        <mesh position={[-0.32, 0.04, 0]}>
          <boxGeometry args={[0.06, 0.22, 0.34]} />
          {darkMat}
        </mesh>
        {/* Oreja derecha */}
        <mesh position={[0.32, 0.04, 0]}>
          <boxGeometry args={[0.06, 0.22, 0.34]} />
          {darkMat}
        </mesh>
      </group>

      {/* ── Brazo izquierdo ───────────────────────────────────── */}
      <group ref={armLRef} position={[-0.44, 0.12, 0]}>
        {/* Hombro */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <sphereGeometry args={[0.12, 10, 10]} />
          {mat}
        </mesh>
        {/* Antebrazo */}
        <mesh position={[-0.05, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.35, 4, 8]} />
          {mat}
        </mesh>
        {/* Mano */}
        <mesh position={[-0.06, -0.48, 0]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          {darkMat}
        </mesh>
      </group>

      {/* ── Brazo derecho ─────────────────────────────────────── */}
      <group ref={armRRef} position={[0.44, 0.12, 0]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <sphereGeometry args={[0.12, 10, 10]} />
          {mat}
        </mesh>
        <mesh position={[0.05, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.35, 4, 8]} />
          {mat}
        </mesh>
        <mesh position={[0.06, -0.48, 0]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          {darkMat}
        </mesh>
      </group>

      {/* ── Cadera ────────────────────────────────────────────── */}
      <mesh position={[0, -0.5, 0]} castShadow>
        <boxGeometry args={[0.6, 0.18, 0.4]} />
        {darkMat}
      </mesh>

      {/* ── Pierna izquierda ──────────────────────────────────── */}
      <group position={[-0.2, -0.9, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.1, 0.4, 4, 8]} />
          {mat}
        </mesh>
        {/* Pie */}
        <mesh position={[0, -0.34, 0.06]}>
          <boxGeometry args={[0.18, 0.1, 0.28]} />
          {darkMat}
        </mesh>
      </group>

      {/* ── Pierna derecha ────────────────────────────────────── */}
      <group position={[0.2, -0.9, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.1, 0.4, 4, 8]} />
          {mat}
        </mesh>
        <mesh position={[0, -0.34, 0.06]}>
          <boxGeometry args={[0.18, 0.1, 0.28]} />
          {darkMat}
        </mesh>
      </group>

      {/* ── Sombra en el suelo ────────────────────────────────── */}
      <mesh position={[0, -1.42, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.4, 24]} />
        <meshStandardMaterial color="#000" transparent opacity={0.18} roughness={1} />
      </mesh>

    </group>
  );
}
