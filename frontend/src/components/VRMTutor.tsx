/**
 * VRMTutor — Avatar 3D del tutor cargado desde /tutor.vrm
 *
 * Funciones:
 *  - Carga el modelo VRM y lo renderiza con Three.js
 *  - speak(text): anima la boca mientras el TTS habla (lip sync simulado)
 *  - setEmotion(state): cambia expresión facial según estado cognitivo
 *  - Animación idle: respiración suave y parpadeo automático
 *
 * Uso:
 *  <VRMTutor ref={vrmRef} className="w-full h-full" />
 *  vrmRef.current?.speak("Hola, soy tu tutor")
 *  vrmRef.current?.setEmotion("mastery")
 */

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

// ─── Tipos públicos ───────────────────────────────────────────────────────────
export type CognitiveEmotion =
  | "normal" | "mastery" | "mastering" | "flow" | "focused" | "learning"
  | "fatigue" | "overload" | "doubt" | "frustration" | "confusion" | "curious";

export interface VRMTutorHandle {
  speak: (durationMs: number) => void;   // activa lip-sync por X ms
  stopSpeak: () => void;
  setEmotion: (emotion: CognitiveEmotion) => void;
  resetEmotion: () => void;
}

interface Props {
  className?: string;
  vrmPath?: string;
  onLoad?: () => void;
  onError?: (err: string) => void;
}

// ─── Mapeo de expresiones VRM → emociones NeuroLearn ─────────────────────────
const EMOTION_MAP: Record<CognitiveEmotion, { preset: string; weight: number }> = {
  normal:      { preset: "neutral",  weight: 1.0 },
  mastery:     { preset: "happy",    weight: 0.9 },
  mastering:   { preset: "happy",    weight: 0.7 },
  flow:        { preset: "relaxed",  weight: 0.8 },
  focused:     { preset: "neutral",  weight: 1.0 },
  learning:    { preset: "surprised", weight: 0.4 },
  fatigue:     { preset: "relaxed",  weight: 0.6 },
  overload:    { preset: "sad",      weight: 0.5 },
  doubt:       { preset: "surprised", weight: 0.5 },
  frustration: { preset: "angry",   weight: 0.4 },
  confusion:   { preset: "sad",     weight: 0.4 },
  curious:     { preset: "surprised", weight: 0.6 },
};

// ─── Componente ───────────────────────────────────────────────────────────────
const VRMTutor = forwardRef<VRMTutorHandle, Props>(
  ({ className = "", vrmPath = "/tutor.vrm", onLoad, onError }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const vrmRef    = useRef<VRM | null>(null);
    const clockRef  = useRef(new THREE.Clock());
    const rafRef    = useRef<number>(0);
    const speakRef  = useRef(false);
    const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
    const [errorMsg,  setErrorMsg]  = useState("");

    // ─── API pública vía ref ─────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      speak(durationMs: number) {
        speakRef.current = true;
        if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
        speakTimerRef.current = setTimeout(() => {
          speakRef.current = false;
        }, durationMs);
      },
      stopSpeak() {
        speakRef.current = false;
        if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
        const vrm = vrmRef.current;
        if (vrm?.expressionManager) {
          vrm.expressionManager.setValue("aa", 0);
          vrm.expressionManager.setValue("oh", 0);
        }
      },
      setEmotion(emotion: CognitiveEmotion) {
        applyEmotion(emotion);
      },
      resetEmotion() {
        applyEmotion("normal");
      },
    }));

    function applyEmotion(emotion: CognitiveEmotion) {
      const vrm = vrmRef.current;
      if (!vrm?.expressionManager) return;
      // Resetear todas las expresiones
      const allPresets = ["happy","sad","angry","surprised","relaxed","neutral","blink","blinkLeft","blinkRight","aa","ih","ou","ee","oh"];
      allPresets.forEach((p) => {
        try { vrm.expressionManager!.setValue(p, 0); } catch { /* preset no existe en este VRM */ }
      });
      const { preset, weight } = EMOTION_MAP[emotion] || EMOTION_MAP.normal;
      try { vrm.expressionManager.setValue(preset, weight); } catch { /* */ }
    }

    // ─── Setup Three.js + carga VRM ─────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      // Escena
      const scene = new THREE.Scene();

      // Cámara — encuadra cuerpo completo del avatar
      const camera = new THREE.PerspectiveCamera(28, canvas.clientWidth / canvas.clientHeight, 0.1, 20);
      camera.position.set(0, 0.9, 3.2);
      camera.lookAt(0, 0.8, 0);

      // Iluminación
      const ambient = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambient);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(1, 2, 2);
      scene.add(dirLight);

      // Loader VRM
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      loader.load(
        vrmPath,
        (gltf) => {
          const vrm: VRM = gltf.userData.vrm;
          VRMUtils.removeUnnecessaryJoints(vrm.scene);
          // Girar para que mire hacia la cámara (VRM usa right-hand)
          VRMUtils.rotateVRM0(vrm);
          vrmRef.current = vrm;
          scene.add(vrm.scene);

          // ─── Pose inicial: brazos colgando naturalmente ──────────────
          if (vrm.humanoid) {
            // Bajar brazos a los costados — en VRM normalizado la T-pose es horizontal,
            // rotación Z negativa en brazo izquierdo y positiva en derecho = bajan
            const leftUpper  = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
            const rightUpper = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
            const leftLower  = vrm.humanoid.getNormalizedBoneNode("leftLowerArm");
            const rightLower = vrm.humanoid.getNormalizedBoneNode("rightLowerArm");
            const leftHand   = vrm.humanoid.getNormalizedBoneNode("leftHand");
            const rightHand  = vrm.humanoid.getNormalizedBoneNode("rightHand");

            if (leftUpper)  { leftUpper.rotation.z  = -1.4;  leftUpper.rotation.x  = 0.05; }
            if (rightUpper) { rightUpper.rotation.z =  1.4;  rightUpper.rotation.x = 0.05; }
            if (leftLower)  { leftLower.rotation.z  =  0.0;  leftLower.rotation.x  = 0.1;  }
            if (rightLower) { rightLower.rotation.z =  0.0;  rightLower.rotation.x = 0.1;  }
            if (leftHand)   { leftHand.rotation.z   = -0.05; leftHand.rotation.x   = 0;    }
            if (rightHand)  { rightHand.rotation.z  =  0.05; rightHand.rotation.x  = 0;    }
          }

          setLoadState("loaded");
          onLoad?.();
        },
        undefined,
        (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMsg(msg);
          setLoadState("error");
          onError?.(msg);
        }
      );

      // ─── Variables de animación ──────────────────────────────────────────
      let blinkTimer  = 0;
      let blinkState  = 0;   // 0=abiertos, 1=cerrando, 2=abriendo
      let speakPhase  = 0;

      // Loop de render
      const animate = () => {
        rafRef.current = requestAnimationFrame(animate);
        const delta = clockRef.current.getDelta();
        const vrm = vrmRef.current;

        if (vrm) {
          vrm.update(delta);

          // ─── Animación idle: respiración + brazos abajo ─────────────────
          const t = clockRef.current.elapsedTime;
          if (vrm.humanoid) {
            const spine = vrm.humanoid.getNormalizedBoneNode("spine");
            if (spine) {
              spine.rotation.z = Math.sin(t * 0.8) * 0.008;
              spine.rotation.x = Math.sin(t * 0.5) * 0.004;
            }
            const head = vrm.humanoid.getNormalizedBoneNode("head");
            if (head) {
              head.rotation.y = Math.sin(t * 0.3) * 0.03;
              head.rotation.x = -0.05 + Math.sin(t * 0.4) * 0.01;
            }
            // Mantener brazos colgando + micro-balanceo de respiración
            const leftUpper2  = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
            const rightUpper2 = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
            const breathe = Math.sin(t * 0.5) * 0.012;
            if (leftUpper2)  leftUpper2.rotation.z  = -1.4 - breathe;
            if (rightUpper2) rightUpper2.rotation.z =  1.4 + breathe;
          }

          // ─── Parpadeo automático ─────────────────────────────────────────
          if (vrm.expressionManager) {
            blinkTimer -= delta;
            if (blinkTimer <= 0) {
              if (blinkState === 0) {
                blinkState = 1;
                blinkTimer = 0.05;
              }
            }
            if (blinkState === 1) {
              const v = vrm.expressionManager.getValue("blink") ?? 0;
              vrm.expressionManager.setValue("blink", Math.min(1, v + delta * 25));
              if ((vrm.expressionManager.getValue("blink") ?? 0) >= 1) {
                blinkState = 2;
              }
            } else if (blinkState === 2) {
              const v = vrm.expressionManager.getValue("blink") ?? 0;
              vrm.expressionManager.setValue("blink", Math.max(0, v - delta * 25));
              if ((vrm.expressionManager.getValue("blink") ?? 0) <= 0) {
                blinkState = 0;
                blinkTimer = 3 + Math.random() * 4; // parpadea cada 3-7s
              }
            }

            // ─── Lip sync simulado ───────────────────────────────────────
            if (speakRef.current) {
              speakPhase += delta * 8;
              const aa = Math.max(0, Math.sin(speakPhase) * 0.5 + 0.1);
              const oh = Math.max(0, Math.sin(speakPhase * 0.7 + 1) * 0.3);
              try { vrm.expressionManager.setValue("aa", aa); } catch { /* */ }
              try { vrm.expressionManager.setValue("oh", oh); } catch { /* */ }
            } else {
              speakPhase = 0;
              try { vrm.expressionManager.setValue("aa", 0); } catch { /* */ }
              try { vrm.expressionManager.setValue("oh", 0); } catch { /* */ }
            }
          }
        }

        renderer.render(scene, camera);
      };
      animate();

      // Responsive resize
      const resizeObserver = new ResizeObserver(() => {
        if (!canvas) return;
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
      });
      resizeObserver.observe(canvas);

      return () => {
        cancelAnimationFrame(rafRef.current);
        resizeObserver.disconnect();
        renderer.dispose();
        if (vrmRef.current) {
          VRMUtils.deepDispose(vrmRef.current.scene);
          vrmRef.current = null;
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vrmPath]);

    return (
      <div className={`relative ${className}`}>
        {/* Canvas 3D */}
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: loadState === "loaded" ? "block" : "none" }}
        />

        {/* Cargando */}
        {loadState === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-violet-50 to-purple-100 rounded-xl">
            <div className="w-12 h-12 border-4 border-violet-300 border-t-violet-600 rounded-full animate-spin mb-3" />
            <p className="text-xs text-violet-600 font-medium">Cargando tutor 3D...</p>
          </div>
        )}

        {/* Error */}
        {loadState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 rounded-xl p-4">
            <span className="text-3xl mb-2">🤖</span>
            <p className="text-xs text-gray-500 text-center">Avatar no disponible</p>
            {errorMsg && (
              <p className="text-[10px] text-red-400 mt-1 text-center line-clamp-2">{errorMsg}</p>
            )}
          </div>
        )}

        {/* Badge "EN VIVO" cuando habla */}
        {loadState === "loaded" && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="text-[10px] bg-black/40 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
              Tutor NeuroLearn
            </span>
          </div>
        )}
      </div>
    );
  }
);

VRMTutor.displayName = "VRMTutor";
export default VRMTutor;
