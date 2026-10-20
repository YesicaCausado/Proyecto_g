"""
NeuroLearn IA — Exportación de los reportes institucionales del Súper Profesor.

Usa exactamente los mismos cálculos que la vista (app/services/super_report_service.py),
con los mismos filtros y el mismo alcance institucional. Nunca genera archivos
vacíos: si la sección no tiene datos responde con un error explicativo.

Secciones: resumen, competencias, grupos, profesores, estudiante, evaluaciones,
seguimiento, evolucion, calidad, completo (todas las anteriores excepto estudiante).
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.services import super_report_service as svc
from app.services.pdf_table import build_report_pdf
from app.services.teacher_report_service import COLOMBIA_TZ, ReportError, _slug

SECTIONS = ("resumen", "competencias", "grupos", "profesores", "estudiante", "evaluaciones",
            "seguimiento", "evolucion", "calidad", "completo")
SECTION_TITLES = {
    "resumen": "Resumen ejecutivo institucional",
    "competencias": "Rendimiento por competencia",
    "grupos": "Comparativo por grupos",
    "profesores": "Desempeño y actividad de profesores",
    "estudiante": "Reporte individual del estudiante",
    "evaluaciones": "Evaluaciones y actividades académicas",
    "seguimiento": "Seguimiento académico",
    "evolucion": "Evolución institucional",
    "calidad": "Calidad y cobertura de los datos",
    "completo": "Reporte institucional completo",
}


@dataclass
class ExportDoc:
    title: str
    meta: List[str]
    blocks: List[dict] = field(default_factory=list)
    filename_base: str = "reporte"
    generated_at: str = ""

    def table_rows(self) -> int:
        return sum(len(b["rows"]) for b in self.blocks if b["type"] == "table")


def _num(v: Optional[float]) -> object:
    return "" if v is None else v


def _pct_text(v: Optional[float]) -> str:
    return "Sin datos" if v is None else f"{v:.1f} %"


def _pp(v: Optional[float]) -> str:
    return "—" if v is None else f"{v:+.1f} pp"


def _date(iso: Optional[str]) -> str:
    if not iso:
        return ""
    dt = datetime.fromisoformat(iso.rstrip("Z")).replace(tzinfo=timezone.utc).astimezone(COLOMBIA_TZ)
    return dt.strftime("%Y-%m-%d %H:%M")


def _meta_lines(meta: dict, user: User) -> List[str]:
    f = meta["filters"]
    applied = [f"{label}: {value}" for label, value in (
        ("Grupo", f["classroom"]), ("Profesor", f["teacher"]), ("Estudiante", f["student"]),
        ("Competencia", f["competency"]),
    ) if value]
    if f["source"] != "todas":
        applied.append("Fuente: " + ("Quizzes adaptativos" if f["source"] == "quiz" else "Evaluaciones docentes"))
    prev = meta["previous_period"]
    inst = meta["institution"]
    return [
        f"Institución: {inst['name']}" + (f" · DANE {inst['dane_code']}" if inst.get("dane_code") else ""),
        f"Período: {meta['period']['label']}"
        + (f" · Período anterior comparable: {prev['start']} a {prev['end']}" if prev else ""),
        "Filtros: " + (" · ".join(applied) if applied else "ninguno (toda la institución)"),
        f"Generado por: {user.full_name or user.username} · {_date(meta['generated_at'])} (hora de Colombia)",
        f"Escala: {meta['scale']}",
    ]


def _resumen(db, user, filters, blocks):
    data = svc.overview(db, user, filters)
    c = data["cards"]
    ev, avg, act = c["evaluated_students"], c["average"], c["activity"]
    best, worst, fu = c["strongest_competency"], c["weakest_competency"], c["followup"]
    rows = [
        ["Estudiantes evaluados", ev["evaluated"], f"de {ev['registered']} registrados · participación "
         f"{_pct_text(ev['participation'])}"],
        ["Rendimiento académico promedio", _num(avg["value"]),
         f"{avg['results']} resultados · variación {_pp(avg['change'])}"],
        ["Competencia más fortalecida", best["name"] if best else "Datos insuficientes",
         f"{best['average']:.1f} % · {best['students']} estudiantes" if best else
         f"Se necesitan ≥{svc.MIN_STUDENTS_COMPARISON} estudiantes en al menos 2 competencias"],
        ["Competencia que requiere más atención", worst["name"] if worst else "Datos insuficientes",
         f"{worst['average']:.1f} % · {worst['gap_to_reference']:+.1f} pp frente al umbral "
         f"{svc.REFERENCE_THRESHOLD:g} %" if worst else "—"],
        ["Estudiantes que requieren seguimiento", fu["students"],
         f"Reglas de rendimiento (umbral {fu['threshold']:g} %, {fu['min_results']} resultados) · "
         f"{fu['activity_students']} más solo por actividad"],
        ["Actividad académica (completadas)", act["completed"],
         f"{act['completed_quizzes']} quizzes · {act['completed_submissions']} entregas · "
         f"{act['open_submissions']} intentos en curso · variación "
         + ("—" if act["change_pct"] is None else f"{act['change_pct']:+.1f} %")],
    ]
    blocks.append({"type": "heading", "text": SECTION_TITLES["resumen"]})
    blocks.append({"type": "table", "headers": ["Indicador", "Valor", "Contexto"], "rows": rows,
                   "weights": [2.2, 1.6, 5.0]})
    _competencias_blocks(data, blocks)
    return data


def _competencias_blocks(data, blocks):
    comps = data["competencies"]
    blocks.append({"type": "heading", "text": SECTION_TITLES["competencias"]})
    blocks.append({"type": "bars", "rows": [
        (c["name"], c["average"], f"{c['students']} est. · {c['results']} result.") for c in comps]})
    blocks.append({"type": "table",
                   "headers": ["Competencia", "Promedio (%)", "Estudiantes evaluados", "Evaluaciones",
                               "Período anterior (%)", "Cambio (pp)"],
                   "rows": [[c["name"], _num(c["average"]), c["students"], c["results"],
                             _num(c["previous_average"]), _num(c["change"])] for c in comps],
                   "weights": [3.0, 1.1, 1.4, 1.1, 1.4, 1.0]})
    if data.get("interpretation"):
        blocks.append({"type": "paragraph", "text": "Interpretación (reglas transparentes):", "gray": 0.0})
        for item in data["interpretation"]:
            blocks.append({"type": "paragraph", "text": "• " + item["text"]})


def _grupos_blocks(data, blocks):
    blocks.append({"type": "heading", "text": SECTION_TITLES["grupos"]})
    groups = data["groups"]
    blocks.append({"type": "bars", "rows": [
        (g["name"], g["average"], f"{g['evaluated']}/{g['enrolled']} evaluados") for g in groups]})
    blocks.append({"type": "table",
                   "headers": ["Grupo", "Profesor", "Inscritos", "Evaluados", "Participación (%)",
                               "Promedio (%)", "Mejor competencia", "Menor competencia", "Cambio (pp)"],
                   "rows": [[g["name"], g["teacher"]["name"] if g["teacher"] else "", g["enrolled"], g["evaluated"],
                             _num(g["participation"]), _num(g["average"]),
                             g["best_competency"]["name"] if g["best_competency"] else "",
                             g["worst_competency"]["name"] if g["worst_competency"] else "",
                             _num(g["change"])] for g in groups],
                   "weights": [1.8, 1.7, 0.8, 0.8, 1.1, 1.0, 2.2, 2.2, 0.9]})


def _profesores_blocks(data, blocks):
    blocks.append({"type": "heading", "text": SECTION_TITLES["profesores"]})
    blocks.append({"type": "paragraph", "text": "El promedio de los estudiantes no mide por sí solo la calidad "
                   "docente: debe leerse junto con el tamaño de los grupos y la participación."})
    blocks.append({"type": "table",
                   "headers": ["Profesor", "Grupos", "Estudiantes", "Evaluados", "Eval. publicadas",
                               "Entregas calificadas", "Promedio (%)", "Menor competencia", "Última actividad"],
                   "rows": [[t["name"], t["groups"], t["students"], t["evaluated"], t["evaluations_published"],
                             t["evaluations_completed"], _num(t["average"]),
                             t["worst_competency"]["name"] if t["worst_competency"] else "",
                             _date(t["last_activity"])] for t in data["teachers"]],
                   "weights": [2.0, 0.7, 0.9, 0.9, 1.0, 1.1, 1.0, 2.2, 1.4]})


def _evolucion_blocks(data, blocks):
    evo = data["evolution"]
    blocks.append({"type": "heading", "text": SECTION_TITLES["evolucion"]})
    if evo["granularity"]:
        blocks.append({"type": "paragraph", "text": "Agrupación: " + {"day": "por día", "week": "por semana",
                                                                        "month": "por mes"}[evo["granularity"]]})
    blocks.append({"type": "table",
                   "headers": ["Período", "Competencia", "Promedio (%)", "Estudiantes evaluados", "Evaluaciones",
                               "Cambio (pp)"],
                   "rows": [[r["period"], r["competency_name"], _num(r["average"]), r["students"], r["results"],
                             _num(r["change"])] for r in evo["table"]],
                   "weights": [1.3, 3.0, 1.1, 1.4, 1.1, 1.0]})


def _calidad_blocks(data, blocks):
    q = data["quality"]
    blocks.append({"type": "heading", "text": SECTION_TITLES["calidad"]})
    rows = [
        ["Estudiantes registrados en el alcance", q["registered_students"]],
        ["Estudiantes con resultados", q["students_with_results"]],
        ["Estudiantes sin resultados (sin datos, no bajo rendimiento)", q["students_without_results"]],
        ["Estudiantes sin grupo asignado", q["students_without_group"]],
        ["Resultados de quizzes adaptativos", q["quiz_results"]],
        ["Resultados oficiales de evaluaciones calificadas", q["graded_results"]],
        ["Entregas por calificar (no cuentan en promedios)", q["pending_review"]],
        ["Intentos de evaluación en curso", q["open_submissions"]],
        ["Quizzes generados sin completar", q["pending_quizzes"]],
        ["Resultados sin competencia identificada", q["unclassified_results"]],
        ["Competencias con datos", ", ".join(q["competencies_with_data"]) or "Ninguna"],
        ["Competencias sin datos", ", ".join(q["competencies_without_data"]) or "Ninguna"],
        ["Último registro", _date(q["latest_record"]) or "—"],
    ]
    blocks.append({"type": "table", "headers": ["Indicador", "Valor"], "rows": rows, "weights": [3.0, 4.0]})
    for w in q["warnings"]:
        blocks.append({"type": "paragraph", "text": "Advertencia: " + w})


def _seguimiento_blocks(data, blocks):
    blocks.append({"type": "heading", "text": SECTION_TITLES["seguimiento"]})
    for r in data["rules"]:
        blocks.append({"type": "paragraph", "text": f"• {r['label']}: {r['definition']} "
                                                    f"(observación: {r['observation']}; mínimo: {r['min_data']})."})
    blocks.append({"type": "paragraph", "text": data["neurodigital_note"]})
    blocks.append({"type": "table",
                   "headers": ["Estudiante", "Grupo(s)", "Competencia", "Motivo", "Evidencia", "Detección",
                               "Evolución"],
                   "rows": [[c["student"]["name"], ", ".join(c["groups"]), c["competency_name"], c["rule_label"],
                             c["reason"], _date(c["detected_at"]),
                             f"{c['evolution']['first']} → {c['evolution']['last']} %" if c["evolution"] else ""]
                            for c in data["items"]],
                   "weights": [1.7, 1.4, 1.9, 1.6, 3.6, 1.2, 1.1]})


def _evaluaciones_blocks(data, blocks):
    ind = data["indicators"]
    blocks.append({"type": "heading", "text": SECTION_TITLES["evaluaciones"]})
    blocks.append({"type": "table", "headers": ["Indicador", "Valor", "Definición"], "rows": [
        ["Evaluaciones en el período", ind["evaluations"], ind["definitions"]["counts"]],
        ["Tasa de finalización", _pct_text(ind["completion_rate"]), ind["definitions"]["completion_rate"]],
        ["Tasa de abandono", _pct_text(ind["abandonment_rate"]), ind["definitions"]["abandonment_rate"]],
        ["Promedio de resultados", _pct_text(ind["average"]), ind["definitions"]["average"]],
    ], "weights": [1.6, 1.0, 5.0]})
    blocks.append({"type": "table",
                   "headers": ["Evaluación", "Competencia", "Grupo", "Profesor", "Estado", "Asignados", "Iniciaron",
                               "Completaron", "Finalización (%)", "Promedio (%)"],
                   "rows": [[e["title"], e["competency_name"], e["group"]["name"], e["teacher"]["name"],
                             e["status_label"], e["assigned"], e["started"], e["completed"],
                             _num(e["completion_rate"]), _num(e["average"])] for e in data["items"]],
                   "weights": [2.2, 2.0, 1.3, 1.4, 0.9, 0.8, 0.8, 0.9, 1.0, 0.9]})


def _estudiante_blocks(data, blocks):
    st, s = data["student"], data["summary"]
    blocks.append({"type": "heading", "text": f"{SECTION_TITLES['estudiante']}: {st['name']}"})
    blocks.append({"type": "paragraph", "text": f"Grupo(s): {', '.join(st['groups']) or 'sin grupo'} · "
                   f"Evaluaciones: {s['results']} · Promedio: {_pct_text(s['average'])} · "
                   f"Última evaluación: {_date(s['last_result']) or '—'}"})
    status_txt = {"avance": "Avance", "refuerzo": "Podría requerir refuerzo", "estable": "Estable",
                  "insuficiente": "Un solo resultado", "sin_datos": "Sin datos"}
    blocks.append({"type": "bars", "rows": [(c["name"], c["average"], status_txt[c["status"]])
                                            for c in data["competencies"]]})
    blocks.append({"type": "table",
                   "headers": ["Fecha", "Competencia", "Actividad", "Fuente", "Resultado (%)", "Puntaje",
                               "Máximo", "Tiempo (min)", "Cambio (pp)"],
                   "rows": [[_date(h["date"]), h["competency_name"], h["title"], h["source_label"], _num(h["pct"]),
                             _num(h["score"]), _num(h["max_score"]),
                             _num(round(h["seconds"] / 60, 1) if h["seconds"] is not None else None),
                             _num(h["change_vs_previous"])] for h in data["history"]],
                   "weights": [1.3, 2.4, 2.4, 1.3, 1.0, 0.8, 0.8, 0.9, 0.9]})


def build_export(db: Session, user: User, filters: svc.Filters, section: str) -> ExportDoc:
    if section not in SECTIONS:
        raise ReportError("Sección de reporte inválida.")
    blocks: List[dict] = []
    if section == "estudiante":
        if filters.student_id is None:
            raise ReportError("Selecciona un estudiante para exportar su reporte individual.")
        data = svc.student_detail(db, user, filters, filters.student_id)
        if not data["history"]:
            raise ReportError("El estudiante no tiene resultados en el período seleccionado.", 404)
        _estudiante_blocks(data, blocks)
        meta = data["meta"]
    elif section == "evaluaciones":
        data = svc.evaluations_report(db, user, filters, page=1, size=100000)
        if not data["items"]:
            raise ReportError("No hay evaluaciones en el período con los filtros seleccionados.", 404)
        _evaluaciones_blocks(data, blocks)
        meta = data["meta"]
    elif section == "seguimiento":
        data = svc.followup_report(db, user, filters, page=1, size=100000)
        if not data["items"]:
            raise ReportError("Ningún estudiante cumple los criterios de seguimiento con los filtros actuales.", 404)
        _seguimiento_blocks(data, blocks)
        meta = data["meta"]
    else:
        data = svc.overview(db, user, filters)
        meta = data["meta"]
        if section in ("resumen", "competencias", "evolucion") and not data["quality"]["students_with_results"]:
            raise ReportError("No hay resultados académicos en el período con los filtros seleccionados.", 404)
        if section == "resumen":
            _resumen(db, user, filters, blocks)
        elif section == "competencias":
            _competencias_blocks(data, blocks)
        elif section == "grupos":
            if not data["groups"]:
                raise ReportError("No hay grupos activos en el alcance seleccionado.", 404)
            _grupos_blocks(data, blocks)
        elif section == "profesores":
            if not data["teachers"]:
                raise ReportError("No hay profesores en el alcance seleccionado.", 404)
            _profesores_blocks(data, blocks)
        elif section == "evolucion":
            _evolucion_blocks(data, blocks)
        elif section == "calidad":
            _calidad_blocks(data, blocks)
        elif section == "completo":
            _resumen(db, user, filters, blocks)
            _grupos_blocks(data, blocks)
            _profesores_blocks(data, blocks)
            ev = svc.evaluations_report(db, user, filters, page=1, size=100000)
            if ev["items"]:
                _evaluaciones_blocks(ev, blocks)
            fu = svc.followup_report(db, user, filters, page=1, size=100000)
            if fu["items"]:
                _seguimiento_blocks(fu, blocks)
            _evolucion_blocks(data, blocks)
            _calidad_blocks(data, blocks)

    quality = data.get("quality")
    if quality and quality["warnings"] and section not in ("calidad", "completo"):
        blocks.append({"type": "heading", "text": "Advertencias sobre los datos"})
        for w in quality["warnings"]:
            blocks.append({"type": "paragraph", "text": "Advertencia: " + w})
    blocks.append({"type": "heading", "text": "Notas metodológicas"})
    for note in meta["methodology"]:
        blocks.append({"type": "paragraph", "text": "• " + note})

    stamp = datetime.now(COLOMBIA_TZ)
    period = meta["period"]
    scope = _slug(meta["filters"]["classroom"] or meta["filters"]["teacher"] or meta["filters"]["student"] or "institucion")
    rng = f"_{period['start'] or 'inicio'}_{period['end'] or 'hoy'}" if (period["start"] or period["end"]) else ""
    return ExportDoc(
        title=SECTION_TITLES[section], meta=_meta_lines(meta, user), blocks=blocks,
        filename_base=f"reporte_{section}_{scope}{rng}", generated_at=stamp.strftime("%Y-%m-%d %H:%M"),
    )


def _csv_value(value: object) -> object:
    """Números con coma decimal (Excel en español); los enteros se mantienen como números."""
    if isinstance(value, bool):
        return "Sí" if value else "No"
    if isinstance(value, float):
        return f"{value:.1f}".replace(".", ",")
    if isinstance(value, int):
        return value
    text = "" if value is None else str(value)
    if re.fullmatch(r"-?\d+\.\d+", text):
        return text.replace(".", ",")
    return text


def to_csv(doc: ExportDoc) -> bytes:
    """CSV UTF-8 con BOM y separador «;»; cada tabla va precedida por su sección."""
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    w.writerow([doc.title])
    for line in doc.meta:
        w.writerow([line])
    for block in doc.blocks:
        if block["type"] == "heading":
            w.writerow([])
            w.writerow([f"## {block['text']}"])
        elif block["type"] == "paragraph":
            w.writerow([block["text"]])
        elif block["type"] == "table":
            w.writerow(block["headers"])
            for row in block["rows"]:
                w.writerow([_csv_value(v) for v in row])
    return ("﻿" + buf.getvalue()).encode("utf-8")


def to_pdf(doc: ExportDoc) -> bytes:
    blocks = []
    for b in doc.blocks:
        if b["type"] == "table":
            b = {**b, "rows": [[_pdf_value(v) for v in row] for row in b["rows"]]}
        blocks.append(b)
    return build_report_pdf(doc.title, doc.meta, blocks, footer="NeuroLearn IA · Uso institucional interno",
                            generated_at=f"{doc.generated_at} (hora de Colombia)")


def _pdf_value(v: object) -> str:
    if v is None or v == "":
        return "—"
    if isinstance(v, float):
        return f"{v:.1f}"
    return str(v)
