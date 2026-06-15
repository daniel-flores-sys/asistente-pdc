"""
application/routes/doc.py — Endpoints HTTP del generador de documentos PDC.

GET  /doc/{plan_id}         → descarga directa del .docx
POST /doc/{plan_id}/upload  → sube a S3 y devuelve URL pre-firmada
"""

from io import BytesIO

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from src.infrastructure.plan_repository import fetch_plan
from src.infrastructure.s3_uploader import upload_to_s3
from src.application.services.doc_builder import build_document

router = APIRouter()

_DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument"
    ".wordprocessingml.document"
)


def _make_filename(plan) -> str:
    return (
        f"PDC_{plan.unidad_educativa}_"
        f"T{plan.trimestre}_P{plan.numero_plan}.docx"
    ).replace(" ", "_")


@router.get("/doc/{plan_id}", summary="Descarga directa del PDC en Word")
def get_document(plan_id: str):
    """
    Genera el documento Word del plan y lo devuelve como stream descargable.
    No requiere configuración de S3.
    """
    try:
        plan = fetch_plan(plan_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=503,
                            detail=f"Error de base de datos: {exc}")

    doc = build_document(plan.model_dump())
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type=_DOCX_MIME,
        headers={"Content-Disposition": f"attachment; filename={_make_filename(plan)}"},
    )


@router.post("/doc/{plan_id}/upload", summary="Genera el PDC y lo sube a S3")
def upload_document(plan_id: str):
    """
    Genera el Word, lo sube a S3 (si está configurado) y devuelve:
      { s3_url, fallback_url, filename }

    Si S3 no está configurado, s3_url es null y fallback_url apunta a
    GET /doc/{plan_id} para descarga directa.
    """
    try:
        plan = fetch_plan(plan_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=503,
                            detail=f"Error de base de datos: {exc}")

    doc = build_document(plan.model_dump())
    buffer = BytesIO()
    doc.save(buffer)

    filename = _make_filename(plan)
    s3_url   = upload_to_s3(buffer, filename)

    if s3_url:
        return {"s3_url": s3_url, "fallback_url": None, "filename": filename}

    return {
        "s3_url":       None,
        "fallback_url": f"/doc/{plan_id}",
        "filename":     filename,
    }
