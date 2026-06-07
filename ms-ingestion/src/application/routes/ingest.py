"""
Rutas de ingestión de documentos.
Soporta PDF (pdfplumber), DOCX (python-docx) y TXT.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query

from src.domain.schemas.ingestion import (
    CollectionInfo,
    DeleteResponse,
    DocumentoRecord,
    IngestResponse,
    ReindexResponse,
)
from src.infrastructure import documento_repository as repo
from src.infrastructure.chroma_store import (
    delete_chunks,
    list_collections,
    store_chunks,
)
from src.infrastructure.embed_client import get_embeddings
from src.infrastructure.pdf_extractor import (
    extract_docx,
    extract_pages,
    extract_txt,
    split_into_chunks,
)

router = APIRouter()

TIPOS_PERMITIDOS = {
    "pdf":  "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt":  "text/plain",
}


def _detect_tipo(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in TIPOS_PERMITIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo no soportado: .{ext}. Acepta: {', '.join(TIPOS_PERMITIDOS)}.",
        )
    return ext


# ── POST /ingest ──────────────────────────────────────────────────────────────

@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    file: UploadFile = File(...),
    coleccion: str   = Query(
        default="curriculum_pdc",
        description="Colección ChromaDB donde se almacenan los vectores",
    ),
):
    """
    Recibe un documento (PDF / DOCX / TXT), extrae su texto, genera embeddings
    con Ollama (o sentence-transformers como fallback), los almacena en ChromaDB
    y registra el documento en PostgreSQL.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="El archivo no tiene nombre.")

    tipo = _detect_tipo(file.filename)
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    # ── Extracción de texto ──────────────────────────────────────────────────
    try:
        if tipo == "pdf":
            pages = extract_pages(file_bytes)
        elif tipo == "docx":
            pages = extract_docx(file_bytes)
        else:
            pages = extract_txt(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"No se pudo leer el archivo: {e}")

    if not pages:
        raise HTTPException(
            status_code=422,
            detail="El documento no contiene texto extraíble.",
        )

    # ── Chunking con metadata de trazabilidad ────────────────────────────────
    all_chunks: list[str]  = []
    all_meta:   list[dict] = []

    for page_num, page_text in pages:
        chunks = split_into_chunks(page_text)
        for chunk_idx, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            all_meta.append({
                "source":      file.filename,
                "page":        page_num,
                "chunk_index": chunk_idx,
            })

    if not all_chunks:
        raise HTTPException(
            status_code=422,
            detail="No se generaron chunks. El texto extraído es demasiado corto.",
        )

    # ── Embeddings ───────────────────────────────────────────────────────────
    try:
        embeddings = get_embeddings(all_chunks)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Error al generar embeddings: {e}",
        )

    # ── Almacenamiento en ChromaDB ───────────────────────────────────────────
    try:
        chroma_ids = store_chunks(all_chunks, all_meta, embeddings, coleccion)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Error al conectar con ChromaDB: {e}",
        )

    # ── Registro en PostgreSQL ───────────────────────────────────────────────
    try:
        doc_id = await repo.insert_documento(
            nombre_archivo=file.filename,
            tipo=tipo,
            chunks_generados=len(chroma_ids),
            chroma_ids=chroma_ids,
        )
    except Exception as e:
        # Los vectores ya están en ChromaDB; registramos el error pero no fallamos
        raise HTTPException(
            status_code=503,
            detail=f"Vectores guardados en ChromaDB pero falló el registro en BD: {e}",
        )

    return IngestResponse(
        documento_id=doc_id,
        coleccion=coleccion,
        archivo=file.filename,
        tipo=tipo,
        chunks_generados=len(chroma_ids),
        mensaje=f"'{file.filename}' ingresado correctamente en la colección '{coleccion}'.",
    )


# ── GET /docs ─────────────────────────────────────────────────────────────────

@router.get("/docs", response_model=list[DocumentoRecord])
async def list_docs():
    """Lista todos los documentos indexados (excluye los marcados como eliminados)."""
    try:
        rows = await repo.get_all_active()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Error al consultar BD: {e}")
    return rows


# ── DELETE /docs/{id} ─────────────────────────────────────────────────────────

@router.delete("/docs/{doc_id}", response_model=DeleteResponse)
async def delete_doc(doc_id: int):
    """
    Elimina los vectores de ChromaDB y marca el documento como 'eliminado' en PostgreSQL.
    No borra el registro de BD para mantener trazabilidad de auditoría.
    """
    chroma_ids = await repo.get_chroma_ids_by_id(doc_id)
    if chroma_ids is None:
        raise HTTPException(status_code=404, detail=f"Documento {doc_id} no encontrado.")

    coleccion = "curriculum_pdc"  # fallback; en una versión futura lo guardamos en BD

    try:
        delete_chunks(coleccion, chroma_ids)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Error al eliminar vectores de ChromaDB: {e}",
        )

    await repo.update_estado(doc_id, "eliminado")

    return DeleteResponse(
        mensaje=f"Documento {doc_id} eliminado de ChromaDB y marcado en BD.",
    )


# ── POST /docs/{id}/reindex ───────────────────────────────────────────────────

@router.post("/docs/{doc_id}/reindex", response_model=ReindexResponse)
async def reindex_doc(doc_id: int):
    """
    No almacenamos el archivo original en disco (diseño intencional para no
    acumular archivos grandes en el contenedor). Para re-indexar, el administrador
    debe subir el archivo nuevamente via POST /ingest.
    """
    return ReindexResponse(
        mensaje="Re-indexación manual requerida — sube el archivo nuevamente via POST /ingest.",
    )


# ── GET /collections ──────────────────────────────────────────────────────────

@router.get("/collections", response_model=list[CollectionInfo])
def get_collections():
    """Lista las colecciones disponibles en ChromaDB con su conteo de vectores."""
    try:
        return list_collections()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"ChromaDB no disponible: {e}")
