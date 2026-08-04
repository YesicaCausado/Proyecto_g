import * as THREE from "three";
import { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import type { Group, AnimationClip } from "three";
import { ROBOT_GLB_PATH } from "./RobotConfig";
import type { Vector3Tuple, EulerTuple } from "./RobotAnimations";

export interface RobotModelProps {
  position:       Vector3Tuple;
  rotation:       EulerTuple;
  scale:          Vector3Tuple;
  glbPath?:       string;
  castShadow?:    boolean;
  receiveShadow?: boolean;
  groupRef?:      React.RefObject<Group | null>;
  onLoaded?:      (clips: AnimationClip[], scene: THREE.Object3D) => void;
  onError?:       (error: Error) => void;
}

export function RobotFallback({ position, scale }: { position: Vector3Tuple; scale: Vector3Tuple }) {
  return (
    <mesh position={position} scale={scale}>
      <capsuleGeometry args={[0.3, 0.8, 4, 8]} />
      <meshStandardMaterial color="#4f8ef7" transparent opacity={0.18} wireframe />
    </mesh>
  );
}

export default function RobotModel({
  position,
  rotation,
  scale,
  glbPath       = ROBOT_GLB_PATH,
  castShadow    = true,
  receiveShadow = false,
  groupRef,
  onLoaded,
  onError,
}: RobotModelProps) {
  const internalRef                = useRef<Group>(null);
  const resolvedRef                = (groupRef ?? internalRef) as React.RefObject<Group>;
  const { scene, animations }      = useGLTF(glbPath, true);

  useEffect(() => {
    if (!scene) return;

    // Resetear transformación interna del GLB para que
    // ROBOT_TRANSFORM en RobotConfig sea el único que manda
    scene.position.set(0, 0, 0);
    scene.rotation.set(0, 0, 0);
    scene.scale.set(1, 1, 1);
    scene.updateMatrixWorld(true);

    // Normalizar escala: que el modelo mida ~2 unidades de alto
    const box    = new THREE.Box3().setFromObject(scene);
    const size   = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim    = Math.max(size.x, size.y, size.z);
    const normScale = 2.0 / maxDim;
    scene.scale.setScalar(normScale);
    scene.position.set(
      -center.x * normScale,
      -center.y * normScale,
      -center.z * normScale,
    );
    scene.updateMatrixWorld(true);

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh             = child as THREE.Mesh;
        mesh.castShadow        = castShadow;
        mesh.receiveShadow     = receiveShadow;
        const mats             = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => { (m as THREE.MeshStandardMaterial).needsUpdate = true; });
      }
    });

    onLoaded?.(animations, scene);
  }, [scene, animations, castShadow, receiveShadow, onLoaded]);

  if (!scene) {
    onError?.(new Error("GLB no disponible: " + glbPath));
    return null;
  }

  return (
    <group ref={resolvedRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(ROBOT_GLB_PATH);
