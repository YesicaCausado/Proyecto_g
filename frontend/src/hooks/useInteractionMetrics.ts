/**
 * Hook: useInteractionMetrics — Patrón de interacción
 *
 * Registra, por turno del chat, eventos de la interfaz con finalidad clara:
 *   - tab_hidden_count / hidden_ms: veces y tiempo con la pestaña oculta
 *   - window_blur_count: veces que la ventana perdió el foco
 *   - suggestion_clicks: uso de preguntas/sugerencias del tutor
 *   - pointer_clicks: clics dentro del área del chat (no en toda la app)
 *   - window_ms: tiempo transcurrido del turno
 *
 * `window_ms` es PERMANENCIA, no tiempo activo: el backend lo informa así.
 * No se registra qué elemento se pulsó ni ningún contenido.
 *
 * Los listeners se registran una sola vez por montaje y se eliminan al
 * desmontar (sin duplicados por re-renderizados).
 */
import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export interface InteractionTurnData {
  window_ms: number;
  tab_hidden_count: number;
  hidden_ms: number;
  window_blur_count: number;
  suggestion_clicks: number;
  pointer_clicks: number;
}

interface Acc {
  start: number; hiddenSince: number | null; hiddenMs: number;
  hiddenCount: number; blurCount: number; suggestionClicks: number; clicks: number;
}

const newAcc = (): Acc => ({
  start: Date.now(),
  hiddenSince: typeof document !== 'undefined' && document.hidden ? Date.now() : null,
  hiddenMs: 0, hiddenCount: 0, blurCount: 0, suggestionClicks: 0, clicks: 0,
});

export function useInteractionMetrics(containerRef?: RefObject<HTMLElement | null>) {
  const acc = useRef<Acc>(newAcc());

  useEffect(() => {
    const onVisibility = () => {
      const a = acc.current;
      if (document.hidden) {
        a.hiddenCount += 1;
        a.hiddenSince = Date.now();
      } else if (a.hiddenSince != null) {
        a.hiddenMs += Date.now() - a.hiddenSince;
        a.hiddenSince = null;
      }
    };
    const onBlur = () => { acc.current.blurCount += 1; };
    const onPointer = (e: PointerEvent) => {
      const root = containerRef?.current;
      if (root && e.target instanceof Node && root.contains(e.target)) acc.current.clicks += 1;
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [containerRef]);

  const beginTurn = useCallback(() => { acc.current = newAcc(); }, []);

  const markSuggestionClick = useCallback(() => { acc.current.suggestionClicks += 1; }, []);

  const getTurnSummary = useCallback((): InteractionTurnData => {
    const a = acc.current;
    const now = Date.now();
    const hidden = a.hiddenMs + (a.hiddenSince != null ? now - a.hiddenSince : 0);
    const windowMs = now - a.start;
    return {
      window_ms: windowMs,
      tab_hidden_count: a.hiddenCount,
      hidden_ms: Math.min(hidden, windowMs),
      window_blur_count: a.blurCount,
      suggestion_clicks: a.suggestionClicks,
      pointer_clicks: a.clicks,
    };
  }, []);

  return { beginTurn, markSuggestionClick, getTurnSummary };
}
