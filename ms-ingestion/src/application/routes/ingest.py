"""
Rutas de ingesta de documentos.
Soporta PDF (pdfplumber), DOCX (python-docx) y TXT.
"""

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from src.domain.schemas.ingestion import (
    CollectionInfo,
    DeleteResponse,
    DocumentoRecord,
    IngestResponse,
    ReindexResponse,
)
from src.infrastructure import documento_repository as repo
from src.infrastructure.chroma_store import delete_chunks, list_collections, store_chunks
from src.infrastructure.embed_client import get_embeddings
from src.infrastructure.pdf_extractor import (
    extract_docx,
    extract_pages,
    extract_txt,
    split_into_chunks,
)

router = APIRouter()

TIPOS_PERMITIDOS = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
}


def _detect_tipo(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in TIPOS_PERMITIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo no soportado: .{ext}. Acepta: {', '.join(TIPOS_PERMITIDOS)}.",
        )
    return ext


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    file: UploadFile = File(...),
    coleccion: str = Query(
        default="curriculum_pdc",
        description="Coleccion ChromaDB donde se almacenan los vectores",
    ),
):
    """
    Recibe un documento, extrae su texto y trata de indexarlo en ChromaDB.
    Si el subsistema vectorial falla, el documento igual queda registrado para
    que la interfaz admin no se rompa y el operador vea el estado real.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="El archivo no tiene nombre.")

    tipo = _detect_tipo(file.filename)
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")

    try:
        if tipo == "pdf":
            pages = extract_pages(file_bytes)
        elif tipo == "docx":
            pages = extract_docx(file_bytes)
        else:
            pages = extract_txt(file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"No se pudo leer el archivo: {exc}")

    if not pages:
        raise HTTPException(
            status_code=422,
            detail="El documento no contiene texto extraible.",
        )

    all_chunks: list[str] = []
    all_meta: list[dict] = []

    for page_num, page_text in pages:
        chunks = split_into_chunks(page_text)
        for chunk_idx, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            all_meta.append(
                {
                    "source": file.filename,
                    "page": page_num,
                    "chunk_index": chunk_idx,
                }
            )

    if not all_chunks:
        raise HTTPException(
            status_code=422,
            detail="No se generaron chunks. El texto extraido es demasiado corto.",
        )

    chroma_ids: list[str] = []
    estado = "indexado"
    mensaje = f"'{file.filename}' ingresado correctamente en la coleccion '{coleccion}'."

    try:
        embeddings = get_embeddings(all_chunks)
        chroma_ids = store_chunks(all_chunks, all_meta, embeddings, coleccion)
    except Exception as exc:
        estado = "error"
        mensaje = (
            f"'{file.filename}' fue registrado, pero la indexacion vectorial quedo pendiente: {exc}"
        )

    try:
        doc_id = await repo.insert_documento(
            nombre_archivo=file.filename,
            tipo=tipo,
            chunks_generados=len(chroma_ids),
            chroma_ids=chroma_ids,
            estado=estado,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Fallo el registro en BD: {exc}",
        )

    return IngestResponse(
        documento_id=doc_id,
        coleccion=coleccion,
        archivo=file.filename,
        tipo=tipo,
        chunks_generados=len(chroma_ids),
        mensaje=mensaje,
    )


@router.get("/docs", response_model=list[DocumentoRecord])
async def list_docs():
    """Lista todos los documentos indexados (excluye los marcados como eliminados)."""
    try:
        rows = await repo.get_all_active()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Error al consultar BD: {exc}")
    return rows


@router.delete("/docs/{doc_id}", response_model=DeleteResponse)
async def delete_doc(doc_id: int):
    """
    Elimina vectores de ChromaDB si existen y marca el documento como eliminado.
    """
    chroma_ids = await repo.get_chroma_ids_by_id(doc_id)
    if chroma_ids is None:
        raise HTTPException(status_code=404, detail=f"Documento {doc_id} no encontrado.")

    if chroma_ids:
        try:
            delete_chunks("curriculum_pdc", chroma_ids)
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Error al eliminar vectores de ChromaDB: {exc}",
            )

    await repo.update_estado(doc_id, "eliminado")

    return DeleteResponse(
        mensaje=f"Documento {doc_id} marcado como eliminado.",
    )


@router.post("/docs/{doc_id}/reindex", response_model=ReindexResponse)
async def reindex_doc(doc_id: int):
    """
    El archivo original no se almacena en el contenedor. Para reindexar,
    el administrador debe volver a subirlo via POST /ingest.
    """
    return ReindexResponse(
        mensaje="Reindexacion manual requerida. Sube el archivo nuevamente via POST /ingest.",
    )


@router.get("/collections", response_model=list[CollectionInfo])
def get_collections():
    """Lista las colecciones disponibles en ChromaDB con su conteo de vectores."""
    try:
        return list_collections()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"ChromaDB no disponible: {exc}")
