"""
NeuroLearn IA — Las cinco competencias académicas (Saber 11) y cómo se asignan.

Fuente única de la clasificación por competencia, usada por los reportes,
las evaluaciones docentes, las aulas y los quizzes adaptativos.

Orden de prioridad para saber a qué competencia pertenece un resultado:
    1. Competencia EXPLÍCITA guardada en el registro (columna `competency` de
       quiz_history, teacher_evaluations o classrooms).
    2. Materia del aula con equivalencia exacta (SUBJECT_COMPETENCY: las
       opciones del formulario «Crear clase»).
    3. Palabras clave sobre el texto (tema, título, materia). Es un respaldo
       para registros anteriores a la columna explícita; descarta materias que
       no son competencias Saber 11 (educación física, artes, tecnología…).

Las claves coinciden con `key` de frontend/src/data/competencies.ts.
"""
from __future__ import annotations

import unicodedata
from typing import Optional, Tuple

COMPETENCIES: Tuple[Tuple[str, str], ...] = (
    ("matematicas", "Pensamiento Lógico-Matemático"),
    ("lectora", "Lectura Crítica y Pensamiento Crítico"),
    ("ingles", "Inglés Comunicativo"),
    ("ciudadanas", "Competencias Ciudadanas y Sociales"),
    ("cientifico", "Pensamiento Científico"),
)
COMP_NAMES = dict(COMPETENCIES)
COMP_KEYS = tuple(k for k, _ in COMPETENCIES)

# Opciones del formulario «Crear clase» (CreateClassroomPage.tsx) → competencia.
SUBJECT_COMPETENCY = {
    "matematicas": "matematicas",
    "razonamiento cuantitativo": "matematicas",
    "lenguaje": "lectora",
    "lectura critica": "lectora",
    "ingles": "ingles",
    "ciencias naturales": "cientifico",
    "ciencias sociales": "ciudadanas",
    "competencias ciudadanas": "ciudadanas",
    "otra": None,
}

# Materias que NO son competencias Saber 11 aunque contengan palabras clave
# (p. ej. «Educación Física» contiene «fisica»).
_EXCLUDED = ("educacion fisica", "deporte", "artistica", "artes", "musica", "danza",
             "tecnologia", "informatica", "religion", "emprendimiento")

# Orden importa: «Ciencias Sociales» es ciudadanas, no científico; «inglés» antes que lectura.
_KEYWORDS = (
    ("ingles", ("ingl", "english")),
    ("matematicas", ("matemat", "cuantitativ", "algebra", "geometr", "estadist", "probabil",
                     "aritmet", "calculo", "trigonom", "ecuacion", "math")),
    ("ciudadanas", ("ciudadan", "social", "historia", "geograf", "democra", "constituc", "etica")),
    ("cientifico", ("cientif", "ciencia", "natural", "biolog", "quimic", "fisica", "ecolog")),
    ("lectora", ("lectur", "lector", "lenguaje", "espanol", "literatur", "comprension", "texto", "critic")),
)


def norm(text: Optional[str]) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    return " ".join(text.lower().split())


def valid_key(value: Optional[str]) -> Optional[str]:
    """La clave si es una de las cinco competencias; None en otro caso."""
    return value if value in COMP_NAMES else None


def from_subject(subject: Optional[str]) -> Optional[str]:
    """Competencia de una materia por equivalencia exacta; si no, por palabras clave."""
    key = norm(subject)
    if key in SUBJECT_COMPETENCY:
        return SUBJECT_COMPETENCY[key]
    return classify_competency(subject)


def classify_competency(*texts: Optional[str]) -> Optional[str]:
    """Primera competencia reconocida por palabras clave en los textos (en orden)."""
    for text in texts:
        t = norm(text)
        if not t or any(x in t for x in _EXCLUDED):
            continue
        for key, words in _KEYWORDS:
            if any(w in t for w in words):
                return key
    return None


def classroom_competency(classroom) -> Optional[str]:
    """Competencia de un aula: la explícita o la deducida de su materia."""
    if classroom is None:
        return None
    return valid_key(getattr(classroom, "competency", None)) or from_subject(classroom.subject)


def evaluation_competency(evaluation, classroom=None) -> Tuple[Optional[str], bool]:
    """(competencia, explícita?) de una evaluación docente."""
    explicit = valid_key(getattr(evaluation, "competency", None))
    if explicit:
        return explicit, True
    if classroom is not None and valid_key(getattr(classroom, "competency", None)):
        return classroom.competency, True
    if classroom is not None and norm(classroom.subject) in SUBJECT_COMPETENCY:
        return SUBJECT_COMPETENCY[norm(classroom.subject)], True
    return classify_competency(classroom.subject if classroom is not None else None, evaluation.title), False


def quiz_competency(quiz) -> Tuple[Optional[str], bool]:
    """(competencia, explícita?) de un quiz adaptativo."""
    explicit = valid_key(getattr(quiz, "competency", None))
    if explicit:
        return explicit, True
    return classify_competency(quiz.topic, quiz.quiz_title), False
