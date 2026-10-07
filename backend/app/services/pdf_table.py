"""
NeuroLearn IA — Generador mínimo de PDF con tablas (sin dependencias).

Produce PDF 1.4 válidos con las fuentes estándar Helvetica / Helvetica-Bold
(codificación WinAnsi, cubre tildes y ñ). Se usa para el reporte del
profesor (/teacher/reports/export) y evita depender de reportlab, que no se
instala en Vercel para mantener la función liviana.

Soporta: título, líneas de metadatos, tabla con encabezado repetido en cada
página, columnas con ancho relativo, recorte de texto largo con «…» y
numeración de páginas.
"""
from __future__ import annotations

import io
from datetime import datetime
from typing import List, Sequence

PAGE_W, PAGE_H = 842.0, 595.0      # A4 horizontal (puntos)
MARGIN = 36.0
ROW_H = 15.0
FONT_SIZE = 8.0
HEADER_FONT_SIZE = 8.0


def _char_width(ch: str) -> float:
    """Ancho aproximado de Helvetica (fracción del tamaño de fuente)."""
    if ch in " .,;:'!|iljtfrI()[]-":
        return 0.30
    if ch in "mwMW@%":
        return 0.85
    if ch.isdigit():
        return 0.556
    if ch.isupper():
        return 0.68
    return 0.52


def text_width(text: str, size: float) -> float:
    return sum(_char_width(c) for c in text) * size


def fit(text: str, width: float, size: float) -> str:
    """Recorta el texto para que quepa en `width` puntos."""
    if text_width(text, size) <= width:
        return text
    ellipsis = "…"
    out = ""
    for ch in text:
        if text_width(out + ch + ellipsis, size) > width:
            break
        out += ch
    return out.rstrip() + ellipsis


def _escape(text: str) -> bytes:
    raw = text.encode("cp1252", errors="replace")
    return raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


class _Page:
    def __init__(self):
        self.ops: List[bytes] = []

    def text(self, x: float, y: float, value: str, size: float = FONT_SIZE, bold: bool = False,
             gray: float = 0.0) -> None:
        font = b"/F2" if bold else b"/F1"
        self.ops.append(
            b"BT %s %.1f Tf %.2f g %.2f %.2f Td (" % (font, size, gray, x, y) + _escape(value) + b") Tj ET"
        )

    def rect(self, x: float, y: float, w: float, h: float, gray: float) -> None:
        self.ops.append(b"%.2f g %.2f %.2f %.2f %.2f re f" % (gray, x, y, w, h))

    def line(self, x1: float, y1: float, x2: float, y2: float, gray: float = 0.8) -> None:
        self.ops.append(b"%.2f G 0.5 w %.2f %.2f m %.2f %.2f l S" % (gray, x1, y1, x2, y2))

    def stream(self) -> bytes:
        return b"\n".join(self.ops)


def build_table_pdf(
    title: str,
    meta_lines: Sequence[str],
    headers: Sequence[str],
    rows: Sequence[Sequence[str]],
    col_weights: Sequence[float],
    footer: str = "NeuroLearn IA",
    generated_at: str = "",
) -> bytes:
    """Devuelve los bytes de un PDF con título, metadatos y una tabla paginada."""
    usable_w = PAGE_W - 2 * MARGIN
    total = float(sum(col_weights)) or 1.0
    widths = [usable_w * w / total for w in col_weights]
    xs = [MARGIN]
    for w in widths[:-1]:
        xs.append(xs[-1] + w)

    pages: List[_Page] = []
    page = None
    y = 0.0

    def new_page(first: bool) -> None:
        nonlocal page, y
        page = _Page()
        pages.append(page)
        y = PAGE_H - MARGIN
        if first:
            page.text(MARGIN, y - 14, title, size=15, bold=True)
            y -= 32
            for line in meta_lines:
                page.text(MARGIN, y, fit(line, usable_w, 9), size=9, gray=0.25)
                y -= 13
            y -= 8
        else:
            page.text(MARGIN, y - 10, fit(title, usable_w, 10), size=10, bold=True, gray=0.3)
            y -= 26
        # Encabezado de la tabla
        page.rect(MARGIN, y - ROW_H + 4, usable_w, ROW_H, 0.92)
        for x, w, h in zip(xs, widths, headers):
            page.text(x + 3, y - 7, fit(str(h), w - 6, HEADER_FONT_SIZE), size=HEADER_FONT_SIZE, bold=True)
        y -= ROW_H

    new_page(first=True)
    for row in rows:
        if y - ROW_H < MARGIN + 18:
            new_page(first=False)
        for x, w, value in zip(xs, widths, row):
            page.text(x + 3, y - 7, fit("" if value is None else str(value), w - 6, FONT_SIZE))
        page.line(MARGIN, y - ROW_H + 4, MARGIN + usable_w, y - ROW_H + 4)
        y -= ROW_H

    generated = generated_at or datetime.now().strftime("%Y-%m-%d %H:%M")
    for i, pg in enumerate(pages, start=1):
        pg.text(MARGIN, MARGIN - 14, f"{footer} · generado {generated}", size=7, gray=0.45)
        label = f"Página {i} de {len(pages)}"
        pg.text(PAGE_W - MARGIN - text_width(label, 7), MARGIN - 14, label, size=7, gray=0.45)

    # Ensamblado del archivo: catálogo, páginas, fuentes y contenidos.
    objects: List[bytes] = []
    n_pages = len(pages)
    font1_id, font2_id = 3, 4
    first_page_id = 5
    kids = " ".join(f"{first_page_id + 2 * i} 0 R" for i in range(n_pages))
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode())
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    for i, pg in enumerate(pages):
        content_id = first_page_id + 2 * i + 1
        objects.append(
            (f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W:.0f} {PAGE_H:.0f}] "
             f"/Resources << /Font << /F1 {font1_id} 0 R /F2 {font2_id} 0 R >> >> "
             f"/Contents {content_id} 0 R >>").encode()
        )
        data = pg.stream()
        objects.append(b"<< /Length %d >>\nstream\n" % len(data) + data + b"\nendstream")

    out = io.BytesIO()
    out.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode() + body + b"\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return out.getvalue()
