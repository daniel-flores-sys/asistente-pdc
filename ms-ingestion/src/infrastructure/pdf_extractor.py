"""
Extrae texto de documentos (PDF, DOCX, TXT) y los divide en chunks para ChromaDB.
Cada chunk mantiene metadata de origen para trazabilidad en el pipeline RAG.
"""

import os
import re

CHUNK_SIZE    = int(os.getenv("CHUNK_SIZE",    "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))


# ── Extractores por tipo ──────────────────────────────────────────────────────

def extract_pages(pdf_bytes: bytes) -> list[tuple[int, str]]:
    """
    Extrae texto de un PDF página a página con pdfplumber.
    Retorna lista de (numero_pagina, texto).
    """
    import pdfplumber
    from io import BytesIO

    pages = []
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = (page.extract_text() or "").strip()
            if text:
                pages.append((i, text))
    return pages


def extract_docx(docx_bytes: bytes) -> list[tuple[int, str]]:
    """
    Extrae texto de un DOCX párrafo a párrafo con python-docx.
    Agrupa los párrafos en secciones numeradas (~una página por cada 30 párrafos)
    para mantener consistencia con el formato de salida de extract_pages.
    """
    import docx
    from io import BytesIO

    doc = docx.Document(BytesIO(docx_bytes))
    pages: list[tuple[int, str]] = []
    section_texts: list[str] = []
    section_num = 1

    for i, para in enumerate(doc.paragraphs, start=1):
        text = para.text.strip()
        if text:
            section_texts.append(text)
        # Agrupar cada 30 párrafos como una "sección" numerada
        if i % 30 == 0 and section_texts:
            pages.append((section_num, "\n\n".join(section_texts)))
            section_texts = []
            section_num += 1

    if section_texts:
        pages.append((section_num, "\n\n".join(section_texts)))

    return pages


def extract_txt(txt_bytes: bytes) -> list[tuple[int, str]]:
    """
    Lee un archivo de texto plano y lo divide en secciones de ~50 líneas.
    """
    text = txt_bytes.decode("utf-8", errors="replace")
    lines = text.splitlines()
    pages: list[tuple[int, str]] = []

    for i, start in enumerate(range(0, len(lines), 50), start=1):
        section = "\n".join(lines[start : start + 50]).strip()
        if section:
            pages.append((i, section))

    return pages


# ── Chunking ──────────────────────────────────────────────────────────────────

def split_into_chunks(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[str]:
    """
    Divide un texto en chunks respetando los saltos de párrafo como puntos
    de corte naturales, con solapamiento para no perder contexto entre chunks.
    """
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)

    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) <= chunk_size:
            current = (current + "\n\n" + para).strip()
        else:
            if current:
                # Añadir overlap del chunk anterior al inicio del siguiente
                overlap_text = current[-overlap:] if len(current) > overlap else current
                chunks.append(current)
                current = (overlap_text + "\n\n" + para).strip()
            elif len(para) > chunk_size:
                # Párrafo único más largo que chunk_size → dividir por palabras
                words = para.split()
                temp = ""
                for word in words:
                    if len(temp) + len(word) + 1 <= chunk_size:
                        temp = (temp + " " + word).strip()
                    else:
                        if temp:
                            chunks.append(temp)
                        temp = word
                current = temp
            else:
                current = para

    if current:
        chunks.append(current)

    return [c for c in chunks if len(c) > 50]
