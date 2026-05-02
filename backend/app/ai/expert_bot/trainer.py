"""
🏗️ NeuroLearn AI - Entrenador de Bot Experto

Permite que un usuario experto:
- Defina procesos paso a paso
- Configure advertencias críticas
- Establezca reglas operativas
- Añada recomendaciones prácticas
- Simule escenarios reales
- Cree pares de pregunta/respuesta

El bot entrenado puede ser compartido con otros usuarios.
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import json


class TrainingDataType(str, Enum):
    STEP = "step"
    WARNING = "warning"
    RULE = "rule"
    TIP = "tip"
    SCENARIO = "scenario"
    QA_PAIR = "qa_pair"
    CONTEXT = "context"


@dataclass
class TrainingStep:
    """Un paso del proceso definido por el experto"""
    order: int
    title: str
    description: str
    details: str = ""
    is_critical: bool = False
    common_errors: List[str] = field(default_factory=list)
    tips: List[str] = field(default_factory=list)


@dataclass
class Warning:
    """Advertencia crítica del experto"""
    message: str
    severity: str = "medium"  # low, medium, high, critical
    when_to_show: str = ""  # Condición para mostrar
    related_steps: List[int] = field(default_factory=list)


@dataclass
class Scenario:
    """Escenario de simulación creado por el experto"""
    title: str
    description: str
    initial_situation: str
    expected_actions: List[str]
    correct_outcome: str
    common_mistakes: List[str] = field(default_factory=list)
    difficulty: str = "medium"


@dataclass
class QAPair:
    """Par de pregunta y respuesta"""
    question: str
    answer: str
    category: str = ""
    difficulty: str = "medium"


@dataclass
class ExpertBotConfig:
    """Configuración completa del bot experto"""
    name: str
    description: str
    category: str
    creator_id: Optional[int] = None
    
    # Personalidad del bot
    teaching_style: str = "balanced"  # strict, balanced, encouraging
    verbosity: str = "medium"  # brief, medium, detailed
    use_examples: bool = True
    use_analogies: bool = True
    
    # Contenido
    steps: List[TrainingStep] = field(default_factory=list)
    warnings: List[Warning] = field(default_factory=list)
    rules: List[str] = field(default_factory=list)
    tips: List[str] = field(default_factory=list)
    scenarios: List[Scenario] = field(default_factory=list)
    qa_pairs: List[QAPair] = field(default_factory=list)
    context_notes: List[str] = field(default_factory=list)
    
    # Dificultad
    min_difficulty: str = "beginner"
    max_difficulty: str = "expert"
    
    # Metadatos
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    version: int = 1
    is_public: bool = False


class ExpertBotTrainer:
    """
    Sistema de entrenamiento para crear bots expertos.
    
    Guía al usuario experto a través del proceso de definición
    de conocimiento estructurado que luego será utilizado por
    el chatbot adaptativo.
    """

    def __init__(self):
        self.config: Optional[ExpertBotConfig] = None
        self.training_step: str = "init"  # Estado del entrenamiento
        self._training_flow = [
            "init",
            "basic_info",
            "personality",
            "steps",
            "warnings",
            "rules",
            "tips",
            "scenarios",
            "qa_pairs",
            "review",
            "complete",
        ]

    def start_training(self, name: str, description: str, 
                        category: str, creator_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Inicia el proceso de entrenamiento del bot experto.
        
        Returns:
            Diccionario con instrucciones y estado del entrenamiento
        """
        self.config = ExpertBotConfig(
            name=name,
            description=description,
            category=category,
            creator_id=creator_id,
        )
        self.training_step = "basic_info"
        
        return {
            "status": "started",
            "message": (
                f"🏗️ ¡Comenzamos el entrenamiento del bot **{name}**!\n\n"
                f"Voy a guiarte paso a paso para definir el conocimiento "
                f"que tu bot compartirá con otros usuarios.\n\n"
                f"📋 Pasos del entrenamiento:\n"
                f"1. ✅ Información básica (completado)\n"
                f"2. ⏳ Personalidad del bot\n"
                f"3. ⬜ Definir pasos del proceso\n"
                f"4. ⬜ Advertencias críticas\n"
                f"5. ⬜ Reglas operativas\n"
                f"6. ⬜ Recomendaciones prácticas\n"
                f"7. ⬜ Escenarios de simulación\n"
                f"8. ⬜ Preguntas frecuentes\n"
                f"9. ⬜ Revisión final\n"
            ),
            "next_step": "personality",
            "prompt": "¿Cómo quieres que sea la personalidad del bot? (estricto/equilibrado/motivador)"
        }

    def set_personality(self, teaching_style: str = "balanced",
                        verbosity: str = "medium",
                        use_examples: bool = True,
                        use_analogies: bool = True) -> Dict[str, Any]:
        """Configura la personalidad del bot"""
        if not self.config:
            return {"error": "Primero debes iniciar el entrenamiento"}
        
        self.config.teaching_style = teaching_style
        self.config.verbosity = verbosity
        self.config.use_examples = use_examples
        self.config.use_analogies = use_analogies
        self.training_step = "personality"
        
        style_desc = {
            "strict": "Estricto y directo",
            "balanced": "Equilibrado y claro",
            "encouraging": "Motivador y empático"
        }
        
        return {
            "status": "personality_set",
            "message": (
                f"✅ Personalidad configurada:\n"
                f"- Estilo: {style_desc.get(teaching_style, teaching_style)}\n"
                f"- Nivel de detalle: {verbosity}\n"
                f"- Usa ejemplos: {'Sí' if use_examples else 'No'}\n"
                f"- Usa analogías: {'Sí' if use_analogies else 'No'}\n"
            ),
            "next_step": "steps",
            "prompt": (
                "Ahora, define los pasos del proceso que tu bot debe enseñar.\n"
                "Para cada paso, proporciona:\n"
                "- Título del paso\n"
                "- Descripción\n"
                "- Si es crítico (sí/no)\n"
                "- Errores comunes en este paso\n"
            )
        }

    def add_step(self, title: str, description: str, details: str = "",
                  is_critical: bool = False, common_errors: List[str] = None,
                  tips: List[str] = None) -> Dict[str, Any]:
        """Añade un paso al proceso"""
        if not self.config:
            return {"error": "Primero debes iniciar el entrenamiento"}
        
        step = TrainingStep(
            order=len(self.config.steps) + 1,
            title=title,
            description=description,
            details=details,
            is_critical=is_critical,
            common_errors=common_errors or [],
            tips=tips or [],
        )
        self.config.steps.append(step)
        self.training_step = "steps"
        
        return {
            "status": "step_added",
            "message": (
                f"✅ Paso {step.order} añadido: **{title}**\n"
                f"{'⚠️ Marcado como CRÍTICO' if is_critical else ''}\n"
                f"Total de pasos: {len(self.config.steps)}"
            ),
            "step_count": len(self.config.steps),
            "prompt": "¿Quieres añadir otro paso? (escribe el siguiente o 'continuar' para avanzar)"
        }

    def add_warning(self, message: str, severity: str = "medium",
                     when_to_show: str = "", related_steps: List[int] = None) -> Dict[str, Any]:
        """Añade una advertencia crítica"""
        if not self.config:
            return {"error": "Primero debes iniciar el entrenamiento"}
        
        warning = Warning(
            message=message,
            severity=severity,
            when_to_show=when_to_show,
            related_steps=related_steps or [],
        )
        self.config.warnings.append(warning)
        self.training_step = "warnings"
        
        severity_emoji = {"low": "ℹ️", "medium": "⚠️", "high": "🔶", "critical": "🔴"}
        
        return {
            "status": "warning_added",
            "message": (
                f"{severity_emoji.get(severity, '⚠️')} Advertencia añadida:\n"
                f"**{message}**\n"
                f"Severidad: {severity}\n"
                f"Total de advertencias: {len(self.config.warnings)}"
            ),
            "warning_count": len(self.config.warnings),
        }

    def add_rule(self, rule: str) -> Dict[str, Any]:
        """Añade una regla operativa"""
        if not self.config:
            return {"error": "Primero debes iniciar el entrenamiento"}
        
        self.config.rules.append(rule)
        self.training_step = "rules"
        
        return {
            "status": "rule_added",
            "message": f"📋 Regla añadida: {rule}\nTotal: {len(self.config.rules)}",
            "rule_count": len(self.config.rules),
        }

    def add_tip(self, tip: str) -> Dict[str, Any]:
        """Añade una recomendación práctica"""
        if not self.config:
            return {"error": "Primero debes iniciar el entrenamiento"}
        
        self.config.tips.append(tip)
        self.training_step = "tips"
        
        return {
            "status": "tip_added",
            "message": f"💡 Tip añadido: {tip}\nTotal: {len(self.config.tips)}",
            "tip_count": len(self.config.tips),
        }

    def add_scenario(self, title: str, description: str, initial_situation: str,
                      expected_actions: List[str], correct_outcome: str,
                      common_mistakes: List[str] = None,
                      difficulty: str = "medium") -> Dict[str, Any]:
        """Añade un escenario de simulación"""
        if not self.config:
            return {"error": "Primero debes iniciar el entrenamiento"}
        
        scenario = Scenario(
            title=title,
            description=description,
            initial_situation=initial_situation,
            expected_actions=expected_actions,
            correct_outcome=correct_outcome,
            common_mistakes=common_mistakes or [],
            difficulty=difficulty,
        )
        self.config.scenarios.append(scenario)
        self.training_step = "scenarios"
        
        return {
            "status": "scenario_added",
            "message": (
                f"🎭 Escenario añadido: **{title}**\n"
                f"Dificultad: {difficulty}\n"
                f"Total de escenarios: {len(self.config.scenarios)}"
            ),
            "scenario_count": len(self.config.scenarios),
        }

    def add_qa_pair(self, question: str, answer: str, 
                     category: str = "", difficulty: str = "medium") -> Dict[str, Any]:
        """Añade un par de pregunta/respuesta"""
        if not self.config:
            return {"error": "Primero debes iniciar el entrenamiento"}
        
        qa = QAPair(
            question=question,
            answer=answer,
            category=category,
            difficulty=difficulty,
        )
        self.config.qa_pairs.append(qa)
        self.training_step = "qa_pairs"
        
        return {
            "status": "qa_added",
            "message": (
                f"❓ Q&A añadido:\n"
                f"**P:** {question}\n"
                f"**R:** {answer[:100]}...\n"
                f"Total: {len(self.config.qa_pairs)}"
            ),
            "qa_count": len(self.config.qa_pairs),
        }

    def get_review(self) -> Dict[str, Any]:
        """Genera una revisión completa del bot entrenado"""
        if not self.config:
            return {"error": "No hay bot en entrenamiento"}
        
        self.training_step = "review"
        
        return {
            "status": "review",
            "message": (
                f"📊 **Revisión del Bot: {self.config.name}**\n\n"
                f"📝 Descripción: {self.config.description}\n"
                f"📁 Categoría: {self.config.category}\n"
                f"🎭 Estilo: {self.config.teaching_style}\n\n"
                f"📋 **Contenido:**\n"
                f"- Pasos del proceso: {len(self.config.steps)}\n"
                f"- Advertencias: {len(self.config.warnings)}\n"
                f"- Reglas: {len(self.config.rules)}\n"
                f"- Tips: {len(self.config.tips)}\n"
                f"- Escenarios: {len(self.config.scenarios)}\n"
                f"- Q&A: {len(self.config.qa_pairs)}\n\n"
                f"{'✅ El bot tiene suficiente contenido para funcionar.' if self._is_ready() else '⚠️ Se recomienda añadir más contenido.'}"
            ),
            "is_ready": self._is_ready(),
            "stats": {
                "steps": len(self.config.steps),
                "warnings": len(self.config.warnings),
                "rules": len(self.config.rules),
                "tips": len(self.config.tips),
                "scenarios": len(self.config.scenarios),
                "qa_pairs": len(self.config.qa_pairs),
            }
        }

    def finalize(self) -> Dict[str, Any]:
        """Finaliza el entrenamiento y retorna la configuración completa"""
        if not self.config:
            return {"error": "No hay bot en entrenamiento"}
        
        self.config.updated_at = datetime.utcnow()
        self.training_step = "complete"
        
        # Convertir a diccionario para almacenamiento
        knowledge_base = self.export_knowledge()
        
        return {
            "status": "complete",
            "message": (
                f"🎉 ¡Bot **{self.config.name}** entrenado exitosamente!\n\n"
                f"El bot está listo para ser utilizado por otros usuarios.\n"
                f"Versión: {self.config.version}\n"
                f"{'🌐 Público' if self.config.is_public else '🔒 Privado'}"
            ),
            "bot_config": {
                "name": self.config.name,
                "description": self.config.description,
                "category": self.config.category,
                "personality": {
                    "teaching_style": self.config.teaching_style,
                    "verbosity": self.config.verbosity,
                    "use_examples": self.config.use_examples,
                    "use_analogies": self.config.use_analogies,
                },
                "knowledge_base": knowledge_base,
                "is_public": self.config.is_public,
                "version": self.config.version,
            }
        }

    def export_knowledge(self) -> Dict:
        """Exporta el conocimiento del bot en formato estructurado"""
        if not self.config:
            return {}
        
        return {
            "steps": [
                {
                    "order": s.order,
                    "title": s.title,
                    "description": s.description,
                    "details": s.details,
                    "is_critical": s.is_critical,
                    "common_errors": s.common_errors,
                    "tips": s.tips,
                }
                for s in self.config.steps
            ],
            "warnings": [
                {
                    "message": w.message,
                    "severity": w.severity,
                    "when_to_show": w.when_to_show,
                    "related_steps": w.related_steps,
                }
                for w in self.config.warnings
            ],
            "rules": self.config.rules,
            "tips": self.config.tips,
            "scenarios": [
                {
                    "title": s.title,
                    "description": s.description,
                    "initial_situation": s.initial_situation,
                    "expected_actions": s.expected_actions,
                    "correct_outcome": s.correct_outcome,
                    "common_mistakes": s.common_mistakes,
                    "difficulty": s.difficulty,
                }
                for s in self.config.scenarios
            ],
            "faq": [
                {
                    "question": qa.question,
                    "answer": qa.answer,
                    "category": qa.category,
                    "difficulty": qa.difficulty,
                }
                for qa in self.config.qa_pairs
            ],
        }

    def _is_ready(self) -> bool:
        """Verifica si el bot tiene suficiente contenido"""
        if not self.config:
            return False
        return (
            len(self.config.steps) >= 3
            or len(self.config.qa_pairs) >= 5
            or (len(self.config.rules) >= 3 and len(self.config.tips) >= 3)
        )
