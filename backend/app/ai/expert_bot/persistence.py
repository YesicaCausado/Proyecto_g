"""
💾 NeuroLearn AI - Sistema de Persistencia de Bots Entrenados

Guarda y carga bots entrenados en archivos JSON para
no perder el progreso de entrenamiento.
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path


# Directorio donde se guardan los bots
BOTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))), "data", "trained_bots")


def ensure_bots_dir():
    """Crea el directorio de bots si no existe"""
    os.makedirs(BOTS_DIR, exist_ok=True)


def save_bot(bot_config: Dict, filename: Optional[str] = None) -> str:
    """
    Guarda un bot entrenado en un archivo JSON.
    
    Args:
        bot_config: Configuración completa del bot (resultado de trainer.finalize())
        filename: Nombre del archivo (opcional, se genera automáticamente)
    
    Returns:
        Ruta completa del archivo guardado
    """
    ensure_bots_dir()
    
    if not filename:
        name = bot_config.get("bot_config", {}).get("name", "bot")
        safe_name = "".join(c if c.isalnum() or c in "-_ " else "" for c in name)
        safe_name = safe_name.replace(" ", "_").lower()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{safe_name}_{timestamp}.json"
    
    if not filename.endswith(".json"):
        filename += ".json"
    
    filepath = os.path.join(BOTS_DIR, filename)
    
    # Agregar metadatos
    bot_config["_metadata"] = {
        "saved_at": datetime.utcnow().isoformat(),
        "file": filename,
        "version": bot_config.get("bot_config", {}).get("version", 1),
    }
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(bot_config, f, ensure_ascii=False, indent=2, default=str)
    
    return filepath


def load_bot(filename: str) -> Optional[Dict]:
    """
    Carga un bot entrenado desde un archivo JSON.
    
    Args:
        filename: Nombre del archivo (con o sin .json)
    
    Returns:
        Configuración del bot o None si no existe
    """
    if not filename.endswith(".json"):
        filename += ".json"
    
    filepath = os.path.join(BOTS_DIR, filename)
    
    if not os.path.exists(filepath):
        # Intentar buscar por nombre parcial
        ensure_bots_dir()
        for f in os.listdir(BOTS_DIR):
            if filename.replace(".json", "") in f:
                filepath = os.path.join(BOTS_DIR, f)
                break
        else:
            return None
    
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def list_bots() -> List[Dict]:
    """
    Lista todos los bots entrenados disponibles.
    
    Returns:
        Lista de diccionarios con info resumida de cada bot
    """
    ensure_bots_dir()
    bots = []
    
    for filename in sorted(os.listdir(BOTS_DIR)):
        if not filename.endswith(".json"):
            continue
        
        filepath = os.path.join(BOTS_DIR, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            config = data.get("bot_config", {})
            kb = config.get("knowledge_base", {})
            
            bots.append({
                "filename": filename,
                "name": config.get("name", "Sin nombre"),
                "description": config.get("description", ""),
                "category": config.get("category", ""),
                "personality": config.get("personality", {}).get("teaching_style", "balanced"),
                "steps": len(kb.get("steps", [])),
                "warnings": len(kb.get("warnings", [])),
                "rules": len(kb.get("rules", [])),
                "tips": len(kb.get("tips", [])),
                "scenarios": len(kb.get("scenarios", [])),
                "faq": len(kb.get("faq", [])),
                "total_items": (
                    len(kb.get("steps", [])) + len(kb.get("warnings", [])) +
                    len(kb.get("rules", [])) + len(kb.get("tips", [])) +
                    len(kb.get("scenarios", [])) + len(kb.get("faq", []))
                ),
                "saved_at": data.get("_metadata", {}).get("saved_at", ""),
                "is_public": config.get("is_public", False),
            })
        except Exception as e:
            bots.append({"filename": filename, "error": str(e)})
    
    return bots


def delete_bot(filename: str) -> bool:
    """Elimina un bot entrenado"""
    if not filename.endswith(".json"):
        filename += ".json"
    filepath = os.path.join(BOTS_DIR, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return True
    return False


def get_bot_quality_score(bot_config: Dict) -> Dict:
    """
    Evalúa la calidad del entrenamiento de un bot.
    Retorna puntuación y recomendaciones de mejora.
    """
    config = bot_config.get("bot_config", bot_config)
    kb = config.get("knowledge_base", {})
    
    scores = {}
    recommendations = []
    
    # Evaluar pasos
    steps = kb.get("steps", [])
    steps_score = min(len(steps) / 5, 1.0) * 100  # 5 pasos = 100%
    scores["steps"] = steps_score
    if len(steps) < 3:
        recommendations.append(f"📝 Añade más pasos al proceso (tienes {len(steps)}, recomendado: 5+)")
    if steps:
        steps_with_details = sum(1 for s in steps if s.get("details"))
        if steps_with_details < len(steps) * 0.6:
            recommendations.append("📝 Añade detalles a más pasos para enriquecer la enseñanza")
        steps_with_errors = sum(1 for s in steps if s.get("common_errors"))
        if steps_with_errors < len(steps) * 0.5:
            recommendations.append("❌ Documenta errores comunes en más pasos")
        steps_with_tips = sum(1 for s in steps if s.get("tips"))
        if steps_with_tips < len(steps) * 0.5:
            recommendations.append("💡 Añade tips a más pasos")
    
    # Evaluar FAQ
    faq = kb.get("faq", [])
    faq_score = min(len(faq) / 10, 1.0) * 100  # 10 FAQ = 100%
    scores["faq"] = faq_score
    if len(faq) < 5:
        recommendations.append(f"❓ Añade más Q&A (tienes {len(faq)}, recomendado: 10+)")
    if faq:
        short_answers = sum(1 for qa in faq if len(qa.get("answer", "")) < 30)
        if short_answers > len(faq) * 0.3:
            recommendations.append("❓ Algunas respuestas son muy cortas, amplíalas")
    
    # Evaluar advertencias
    warnings = kb.get("warnings", [])
    warnings_score = min(len(warnings) / 3, 1.0) * 100
    scores["warnings"] = warnings_score
    if len(warnings) < 2:
        recommendations.append(f"⚠️ Añade más advertencias (tienes {len(warnings)}, recomendado: 3+)")
    
    # Evaluar reglas
    rules = kb.get("rules", [])
    rules_score = min(len(rules) / 5, 1.0) * 100
    scores["rules"] = rules_score
    if len(rules) < 3:
        recommendations.append(f"📋 Añade más reglas (tienes {len(rules)}, recomendado: 5+)")
    
    # Evaluar tips
    tips = kb.get("tips", [])
    tips_score = min(len(tips) / 5, 1.0) * 100
    scores["tips"] = tips_score
    if len(tips) < 3:
        recommendations.append(f"💡 Añade más tips (tienes {len(tips)}, recomendado: 5+)")
    
    # Evaluar escenarios
    scenarios = kb.get("scenarios", [])
    scenarios_score = min(len(scenarios) / 3, 1.0) * 100
    scores["scenarios"] = scenarios_score
    if len(scenarios) < 1:
        recommendations.append("🎭 Añade al menos 1 escenario de simulación")
    elif len(scenarios) < 3:
        recommendations.append(f"🎭 Añade más escenarios (tienes {len(scenarios)}, recomendado: 3+)")
    
    # Puntuación total ponderada
    weights = {"steps": 0.25, "faq": 0.25, "warnings": 0.1, "rules": 0.1, "tips": 0.1, "scenarios": 0.2}
    total = sum(scores[k] * weights[k] for k in scores)
    
    # Nivel de calidad
    if total >= 90:
        level = "🏆 EXCELENTE"
    elif total >= 70:
        level = "🌟 BUENO"
    elif total >= 50:
        level = "📊 ACEPTABLE"
    elif total >= 30:
        level = "⚠️ BÁSICO"
    else:
        level = "🔴 INSUFICIENTE"
    
    return {
        "total_score": round(total, 1),
        "level": level,
        "scores": {k: round(v, 1) for k, v in scores.items()},
        "recommendations": recommendations,
        "total_items": sum(len(kb.get(k, [])) for k in ["steps", "faq", "warnings", "rules", "tips", "scenarios"]),
    }
