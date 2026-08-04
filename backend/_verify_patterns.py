"""
Suite completa de verificación — 5 Patrones Neuroconductuales NeuroLearn AI
Valida inferencia de estados, adaptación del system prompt,
transiciones entre estados, y comportamiento multimodal combinado.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8")

from app.ai.cognitive.neuroconductual_engine import (
    MultimodalCognitiveEngine, BehavioralEvent, FacialData,
    VoiceProsodyData, EmotionEnum,
)
from app.api.chat import _build_system_prompt
from datetime import datetime

SEP  = "-" * 65
SEP2 = "=" * 65

PASS = 0
FAIL = 0


def check(label, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS  {label}")
    else:
        FAIL += 1
        print(f"  FAIL  {label}  | {detail}")


def make_evt(rt=3200, speed=140, corr=0, pause=500, length=50):
    return BehavioralEvent(
        timestamp=datetime.now(), event_type="response",
        response_time_ms=rt, typing_speed_cpm=speed,
        correction_made=corr > 0, error_occurred=corr >= 5,
        pause_duration_ms=pause, content_length=length,
    )


def make_stats(n=3, err_streak=0, fast=0, slow=0, qerr=0.1, weak=None):
    return {"msg_count": n, "error_streak": err_streak,
            "fast_replies": fast, "slow_replies": slow,
            "quiz_error_rate": qerr, "weak_concepts": weak or []}


def prompt_for(state, stats=None, risk=0.1):
    return _build_system_prompt("Ecuaciones", state, stats or make_stats(), risk)


# =============================================================================
# BLOQUE 1: Inferencia de estados por datos de comportamiento (P1 + P2)
# =============================================================================
print(f"\n{SEP2}")
print("  BLOQUE 1: INFERENCIA DE ESTADOS (P1+P2 - Ritmo e Interaccion)")
print(SEP2)


def infer_final(cases):
    eng = MultimodalCognitiveEngine()
    r = None
    for c in cases:
        r = eng.add_multimodal_event(behavioral=make_evt(*c))
    return r


# 1.1 Respuesta lenta → overload/fatigue
r = infer_final([(9500, 40, 0, 6000)] * 4)
check("P1 -- rt=9500ms infiere overload o fatigue",
      r and r.state.value in ("overload", "fatigue"),
      f"got={r.state.value if r else 'None'}")
check("P1 -- rt=9500ms engagement bajo (<0.6)",
      r and r.engagement_score < 0.6,
      f"got={r.engagement_score:.2f}" if r else "")

# 1.2 Respuesta rapida → flow/mastery
r = infer_final([(1200, 230, 0, 150, 90)] * 4)
check("P1 -- rt=1200ms infiere flow o mastery",
      r and r.state.value in ("flow", "mastery"),
      f"got={r.state.value if r else 'None'}")
check("P1 -- rt=1200ms engagement alto (>0.6)",
      r and r.engagement_score > 0.6,
      f"got={r.engagement_score:.2f}" if r else "")

# 1.3 Muchas correcciones → error_risk alto
r = infer_final([(7000, 55, 10, 3500)] * 4)
check("P2 -- 10 correcciones dispara error_risk >70%",
      r and r.error_risk > 0.70,
      f"got={r.error_risk:.0%}" if r else "")
check("P2 -- 10 correcciones engagement bajo (<0.5)",
      r and r.engagement_score < 0.5,
      f"got={r.engagement_score:.2f}" if r else "")

# 1.4 Sin correcciones → error_risk bajo
r = infer_final([(2800, 160, 0, 400)] * 4)
check("P2 -- 0 correcciones error_risk <40%",
      r and r.error_risk < 0.40,
      f"got={r.error_risk:.0%}" if r else "")

# 1.5 Error_prediction activo a partir del 3er mensaje
r = infer_final([(3000, 130, 0, 500)] * 3)
check("P5 -- error_prediction activa en msg 3+",
      r and "error_prediction" in r.active_modalities,
      f"modalities={r.active_modalities}" if r else "")

# 1.6 Respuesta muy corta + pausa muy larga = probable duda
r = infer_final([(6000, 45, 2, 5500, 8)] * 4)
check("P1 -- pausa larga + mensaje corto = engagement bajo",
      r and r.engagement_score < 0.6,
      f"got={r.engagement_score:.2f}" if r else "")

# 1.7 Velocidad escritura muy alta = posible copia/respuesta automatica
r = infer_final([(800, 590, 0, 100, 200)] * 3)
check("P1 -- typing_speed 590cpm da engagement alto",
      r and r.engagement_score > 0.5,
      f"got={r.engagement_score:.2f}" if r else "")

# =============================================================================
# BLOQUE 2: Transiciones de estado a lo largo de la sesion
# =============================================================================
print(f"\n{SEP2}")
print("  BLOQUE 2: TRANSICIONES ENTRE ESTADOS")
print(SEP2)

eng = MultimodalCognitiveEngine()
states_seq = []
# Fase rapida (flow)
for rt, speed, corr in [(1200, 220, 0)] * 3:
    r = eng.add_multimodal_event(behavioral=make_evt(rt, speed, corr))
    if r:
        states_seq.append(r.state.value)
# Fase lenta prolongada (overload/fatigue)
for _ in range(6):
    r = eng.add_multimodal_event(behavioral=make_evt(12000, 30, 0, 8000))
    if r:
        states_seq.append(r.state.value)

# Normalizar: la fase fast debe tener algun estado positivo y la fase slow alguno pesado
fast_states = states_seq[:3]
slow_states = states_seq[3:]
print(f"  Secuencia estados: {states_seq}")
early_positive = any(s in ("flow", "mastery", "normal", "curiosity") for s in fast_states)
late_heavy = any(s in ("overload", "fatigue", "frustration", "doubt", "normal") for s in slow_states)
check("Transicion: fase rapida tiene estado positivo (flow/mastery/normal)",
      early_positive, f"fast_states={fast_states}")
check("Transicion: fase lenta tiene estado no-flow (overload/fatigue/doubt/normal)",
      late_heavy, f"slow_states={slow_states}")

# Recuperacion post-fatiga
eng2 = MultimodalCognitiveEngine()
for _ in range(3):
    eng2.add_multimodal_event(behavioral=make_evt(9500, 40, 0, 6000))
r_tired = eng2.add_multimodal_event(behavioral=make_evt(9500, 40, 0, 6000))
for _ in range(3):
    eng2.add_multimodal_event(behavioral=make_evt(1500, 200, 0, 300))
r_recovered = eng2.add_multimodal_event(behavioral=make_evt(1400, 210, 0, 250))
check("Recuperacion: engagement sube tras secuencia rapida post-fatiga",
      r_recovered and r_tired and r_recovered.engagement_score > r_tired.engagement_score,
      f"tired={r_tired.engagement_score:.2f} recovered={r_recovered.engagement_score:.2f}"
      if r_tired and r_recovered else "")

# Error_risk acumula y luego disminuye
eng3 = MultimodalCognitiveEngine()
for _ in range(3):
    eng3.add_multimodal_event(behavioral=make_evt(7000, 60, 8, 3000))
r_bad = eng3.add_multimodal_event(behavioral=make_evt(7000, 60, 8, 3000))
for _ in range(3):
    eng3.add_multimodal_event(behavioral=make_evt(2500, 170, 0, 300))
r_better = eng3.add_multimodal_event(behavioral=make_evt(2200, 180, 0, 250))
check("Error_risk disminuye tras mensajes sin correcciones",
      r_bad and r_better and r_better.error_risk < r_bad.error_risk,
      f"bad={r_bad.error_risk:.0%} better={r_better.error_risk:.0%}"
      if r_bad and r_better else "")

# =============================================================================
# BLOQUE 3: Patron 3 — Facial Microexpression
# =============================================================================
print(f"\n{SEP2}")
print("  BLOQUE 3: P3 -- MICROEXPRESION FACIAL")
print(SEP2)


def make_face(emotion, valence, arousal, attention, blink=12, furrow=0.1, smile=0.2, conf=0.85):
    return FacialData(
        timestamp=datetime.now(), emotion=emotion,
        valence=valence, arousal=arousal, attention_score=attention,
        blink_rate=blink, brow_furrow=furrow, smile_intensity=smile,
        emotion_confidence=conf,
    )


faces = [
    ("HAPPY/atenta",  EmotionEnum.HAPPY,     0.7,  0.6, 0.9,  8, 0.0, 0.8, 0.9, True),
    ("FOCUSED",       EmotionEnum.FOCUSED,   0.4,  0.7, 0.85, 9, 0.1, 0.3, 0.9, True),
    ("CONFUSED",      EmotionEnum.CONFUSED, -0.5,  0.7, 0.3, 28, 0.85, 0.0, 0.88, False),
    ("BORED",         EmotionEnum.BORED,    -0.3,  0.1, 0.2, 22, 0.4,  0.0, 0.80, False),
    ("ANGRY",         EmotionEnum.ANGRY,    -0.7,  0.9, 0.4, 30, 0.95, 0.0, 0.92, False),
    ("SURPRISED/pos", EmotionEnum.SURPRISED, 0.5,  0.8, 0.75, 14, 0.1, 0.5, 0.82, True),
]

for label, emotion, val, arou, att, blink, furrow, smile, conf, expect_high_eng in faces:
    eng_f = MultimodalCognitiveEngine()
    r = eng_f.add_multimodal_event(
        facial=make_face(emotion, val, arou, att, blink, furrow, smile, conf)
    )
    check(f"P3 -- cara {label} activa 'facial_microexpression'",
          r and "facial_microexpression" in r.active_modalities,
          f"modalities={r.active_modalities}" if r else "")
    if expect_high_eng:
        check(f"P3 -- cara {label} engagement >0.4",
              r and r.engagement_score > 0.4,
              f"got={r.engagement_score:.2f}" if r else "")
    else:
        check(f"P3 -- cara {label} engagement <0.5",
              r and r.engagement_score < 0.5,
              f"got={r.engagement_score:.2f}" if r else "")

# =============================================================================
# BLOQUE 4: Patron 4 — Prosodia de Voz
# =============================================================================
print(f"\n{SEP2}")
print("  BLOQUE 4: P4 -- PROSODIA DE VOZ")
print(SEP2)


def make_voice(pitch=140, vol=65, wpm=150, tremor=0.05, energy=0.8, fillers=1, pause_ratio=0.1):
    return VoiceProsodyData(
        timestamp=datetime.now(), pitch_mean_hz=pitch, volume_db=vol,
        speech_rate_wpm=wpm, voice_tremor=tremor, energy_level=energy,
        filler_words_count=fillers, pause_ratio=pause_ratio,
    )


voices = [
    ("fluida/segura",       140, 65, 155, 0.05, 0.8,  1, 0.1,  True),
    ("rapida/energica",     155, 70, 175, 0.02, 0.9,  0, 0.05, True),
    ("lenta/temblorosa",    185, 47,  80, 0.75, 0.2,  8, 0.5,  False),
    ("monótona/baja energia", 130, 42, 95, 0.1,  0.1,  3, 0.4,  False),
    ("muchos fillers",      150, 60, 100, 0.3,  0.4, 10, 0.35, False),
]

for label, pitch, vol, wpm, tremor, energy, fillers, pause, expect_high in voices:
    eng_v = MultimodalCognitiveEngine()
    r = eng_v.add_multimodal_event(voice=make_voice(pitch, vol, wpm, tremor, energy, fillers, pause))
    check(f"P4 -- voz {label} activa 'voice_prosody'",
          r and "voice_prosody" in r.active_modalities)
    if expect_high:
        check(f"P4 -- voz {label} engagement >0.5",
              r and r.engagement_score > 0.5,
              f"got={r.engagement_score:.2f}" if r else "")
    else:
        check(f"P4 -- voz {label} engagement <0.6",
              r and r.engagement_score < 0.6,
              f"got={r.engagement_score:.2f}" if r else "")

# =============================================================================
# BLOQUE 5: Patron 5 — Historial de quizzes eleva/afecta el prompt
# =============================================================================
print(f"\n{SEP2}")
print("  BLOQUE 5: P5 -- PREDICCION DE ERROR (historial de quizzes)")
print(SEP2)

# Alto error rate → HISTORIAL en prompt + menciona conceptos debiles
stats_bad = make_stats(n=3, qerr=0.75, weak=["discriminante", "formula general", "factorizacion"])
p_bad = prompt_for("overload", stats_bad, risk=0.75)
check("P5 -- historial >50% incluye 'HISTORIAL' en prompt",
      "HISTORIAL" in p_bad.upper())
check("P5 -- historial >50% menciona conceptos debiles en prompt",
      any(w in p_bad.lower() for w in ["discriminante", "formula", "factorizacion"]),
      "weak concepts not found")
check("P5 -- risk=75% incluye advertencia de riesgo en prompt",
      "RIESGO" in p_bad.upper() or "ERROR" in p_bad.upper())

# Moderado error rate → referencia leve
stats_mid = make_stats(n=5, qerr=0.35, weak=["raices"])
p_mid = prompt_for("normal", stats_mid, risk=0.35)
check("P5 -- historial 25-50% incluye referencia en prompt",
      "HISTORIAL" in p_mid.upper() or "raices" in p_mid.lower())

# Cero errores → no fuerza bloque
stats_clean = make_stats(n=1, qerr=0.0)
p_clean = prompt_for("flow", stats_clean, risk=0.05)
check("P5 -- historial 0% no inserta bloque HISTORIAL",
      "HISTORIAL" not in p_clean.upper())

# Risk > 45% activa advertencia
p_high_risk = prompt_for("normal", make_stats(), risk=0.5)
check("P5 -- error_risk >45% activa advertencia en prompt",
      "RIESGO" in p_high_risk.upper())

# Risk <= 45% no activa advertencia
p_low_risk = prompt_for("normal", make_stats(), risk=0.3)
check("P5 -- error_risk <45% no activa advertencia de riesgo",
      "RIESGO" not in p_low_risk.upper())

# =============================================================================
# BLOQUE 6: Adaptacion del system prompt por estado cognitivo
# =============================================================================
print(f"\n{SEP2}")
print("  BLOQUE 6: ADAPTACION DEL PROMPT POR ESTADO COGNITIVO")
print(SEP2)

state_keywords = {
    "fatigue":     ["PAUSA", "CORTO", "SOLO", "FATIGA"],
    "overload":    ["SOBRECARGA", "SIMPLE", "OBLIGATORIAS"],
    "frustration": ["FRUSTRACI", "SIMPLIFICA", "MOTIVA"],
    "flow":        ["FLUJO", "AVANZADOS", "PROFUNDIZA"],
    "mastery":     ["DOMINIO", "NIVEL"],
    "doubt":       ["DUDA", "ANGULO", "EJEMPLOS"],
    "curiosity":   ["CURIOSIDAD", "CONECTA"],
    "normal":      ["NORMAL", "ESTANDAR"],
}

all_prompts = {}
for state, keywords in state_keywords.items():
    p = prompt_for(state)
    all_prompts[state] = p
    found = [kw for kw in keywords if kw in p.upper()]
    check(f"Prompt estado '{state}' tiene instruccion especifica",
          len(found) >= 1,
          f"buscados={keywords} encontrados={found}")

# Verificar que fatigue y mastery tienen contenido diferente (no idéntico)
check("Prompt 'fatigue' difiere de 'mastery'",
      all_prompts["fatigue"] != all_prompts["mastery"])

# Verificar diferenciacion total
unique_blocks = set()
for state, p in all_prompts.items():
    idx = p.upper().find("ADAPTACI")
    if idx >= 0:
        unique_blocks.add(p[idx:idx+120])
check("Todos los estados generan bloques de adaptacion distintos",
      len(unique_blocks) == len(state_keywords),
      f"unique={len(unique_blocks)}/{len(state_keywords)}")

# =============================================================================
# BLOQUE 7: Multimodal combinado (todos los patrones juntos)
# =============================================================================
print(f"\n{SEP2}")
print("  BLOQUE 7: MULTIMODAL COMBINADO (P1+P2+P3+P4)")
print(SEP2)

eng_multi = MultimodalCognitiveEngine()

# Msg 1: normal + cara atenta
r1 = eng_multi.add_multimodal_event(
    behavioral=make_evt(2800, 150, 0, 400),
    facial=make_face(EmotionEnum.FOCUSED, 0.3, 0.6, 0.85, 10, 0.1, 0.3, 0.9),
)
check("Multi msg1: P1+P3 activos simultaneamente",
      r1 and "interaction_rhythm" in r1.active_modalities
      and "facial_microexpression" in r1.active_modalities,
      f"modalities={r1.active_modalities}" if r1 else "")

# Msg 2: todo negativo → señal combinada fuerte
r2 = eng_multi.add_multimodal_event(
    behavioral=make_evt(8000, 60, 7, 4000),
    facial=make_face(EmotionEnum.CONFUSED, -0.6, 0.8, 0.25, 30, 0.9, 0.0, 0.92),
    voice=make_voice(185, 47, 75, 0.8, 0.15, 7, 0.6),
)
check("Multi msg2 (todo negativo): P1+P2+P3+P4 activos",
      r2 and all(m in r2.active_modalities for m in
                 ["interaction_rhythm", "decision_sequence",
                  "facial_microexpression", "voice_prosody"]),
      f"modalities={r2.active_modalities}" if r2 else "")
check("Multi msg2: error_risk alto (>0.5)",
      r2 and r2.error_risk > 0.5,
      f"got={r2.error_risk:.0%}" if r2 else "")
check("Multi msg2: engagement muy bajo (<0.4)",
      r2 and r2.engagement_score < 0.4,
      f"got={r2.engagement_score:.2f}" if r2 else "")

# Msg 3: recuperacion → engagement sube
r3 = eng_multi.add_multimodal_event(
    behavioral=make_evt(1400, 210, 0, 180),
    facial=make_face(EmotionEnum.HAPPY, 0.8, 0.5, 0.92, 9, 0.0, 0.9, 0.95),
)
check("Multi msg3 (recuperacion): engagement sube vs msg2",
      r3 and r2 and r3.engagement_score > r2.engagement_score,
      f"msg2={r2.engagement_score:.2f} msg3={r3.engagement_score:.2f}"
      if r2 and r3 else "")

# =============================================================================
# BLOQUE 8: Coherencia y robustez
# =============================================================================
print(f"\n{SEP2}")
print("  BLOQUE 8: COHERENCIA Y ROBUSTEZ")
print(SEP2)

eng_r = MultimodalCognitiveEngine()
r = eng_r.add_multimodal_event(behavioral=make_evt())
check("Motor devuelve resultado en el primer mensaje", r is not None)
check("Resultado tiene todos los campos requeridos",
      r and all(hasattr(r, f) for f in [
          "state", "probability", "error_risk", "engagement_score",
          "active_modalities", "modality_probs", "state_distribution"]))
check("state_distribution suma ~1.0",
      r and abs(sum(r.state_distribution.values()) - 1.0) < 0.02,
      f"sum={sum(r.state_distribution.values()):.3f}" if r else "")
check("probability en [0,1]",
      r and 0.0 <= r.probability <= 1.0,
      f"got={r.probability}" if r else "")
check("error_risk en [0,1]",
      r and 0.0 <= r.error_risk <= 1.0,
      f"got={r.error_risk}" if r else "")
check("engagement_score en [0,1]",
      r and 0.0 <= r.engagement_score <= 1.0,
      f"got={r.engagement_score}" if r else "")

# Input extremo no debe crashear
try:
    r_ex = MultimodalCognitiveEngine().add_multimodal_event(
        behavioral=make_evt(rt=999999, speed=0, corr=100, pause=999999, length=0))
    check("Robustez -- input extremo no lanza excepcion", r_ex is not None)
except Exception as e:
    check("Robustez -- input extremo no lanza excepcion", False, str(e))

# Sin datos: el motor puede devolver None o un estado default — ambos son validos
try:
    r_empty = MultimodalCognitiveEngine().add_multimodal_event()
    check("Robustez -- sin datos no lanza excepcion", True)
except Exception as e:
    check("Robustez -- sin datos no lanza excepcion", False, str(e))

# Multiples usuarios tienen motores independientes (no se contaminan)
from app.api.chat import _get_user_engine, _session_stats
_session_stats.pop("u11111", None)
_session_stats.pop("u22222", None)
e1 = _get_user_engine(11111)
e2 = _get_user_engine(22222)
check("Motores por usuario son instancias independientes", e1 is not e2)

# =============================================================================
# BLOQUE 9: Acumulacion de estadisticas de sesion
# =============================================================================
print(f"\n{SEP2}")
print("  BLOQUE 9: ACUMULACION DE ESTADISTICAS DE SESION")
print(SEP2)

from app.api.chat import _update_session_stats

uid = 99999
_session_stats.pop(f"u{uid}", None)
_get_user_engine(uid)

s1 = _update_session_stats(uid, 1200, 0, 0.1, [])
check("Session stats: msg_count=1 tras primer mensaje", s1["msg_count"] == 1)

# Usar rt muy bajo (300ms) para garantizar < avg_rt*0.6
s2 = _update_session_stats(uid, 300, 0, 0.1, [])
s3 = _update_session_stats(uid, 300, 0, 0.1, [])
check("Session stats: fast_replies acumula (rt muy bajo)",
      s3["fast_replies"] > 0, f"fast_replies={s3['fast_replies']}")

s4 = _update_session_stats(uid, 9000, 7, 0.7, ["factor"])
s4_error_streak = s4["error_streak"]   # guardar snapshot antes de mutar
check("Session stats: error_streak sube con correcciones>=5",
      s4_error_streak > 0, f"err_streak={s4_error_streak}")
check("Session stats: weak_concepts se guarda",
      s4["weak_concepts"] == ["factor"])
check("Session stats: quiz_error_rate actualiza",
      s4["quiz_error_rate"] == 0.7, f"got={s4['quiz_error_rate']}")

s5 = _update_session_stats(uid, 3000, 0, 0.7, [])
s5_error_streak = s5["error_streak"]
check("Session stats: error_streak reduce con corr<5",
      s5_error_streak < s4_error_streak,
      f"s4_snap={s4_error_streak} s5={s5_error_streak}")

s6 = _update_session_stats(uid, 12000, 0, 0.1, [])
check("Session stats: slow_replies acumula (rt muy alto)",
      s6["slow_replies"] > 0, f"slow_replies={s6['slow_replies']}")

check("Session stats: msg_count es correcto al final",
      s6["msg_count"] == 6, f"got={s6['msg_count']}")

# =============================================================================
# RESUMEN FINAL
# =============================================================================
total = PASS + FAIL
print(f"\n{SEP2}")
print("  RESUMEN FINAL DE VERIFICACION")
print(SEP2)
print(f"  Total pruebas : {total}")
print(f"  Pasadas (PASS): {PASS}")
print(f"  Falladas (FAIL): {FAIL}")
print(f"  Cobertura     : {PASS/total*100:.1f}%")
print()
if FAIL == 0:
    print("  TODOS LOS PATRONES NEUROCONDUCTUALES FUNCIONAN PERFECTAMENTE")
else:
    print(f"  {FAIL} prueba(s) requieren revision")
print(SEP2)
