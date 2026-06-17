"""
infrastructure/s3_uploader.py — Subida opcional de documentos a AWS S3.

Si las variables AWS_* no están configuradas, upload_to_s3() devuelve None
y el servicio usa el endpoint GET /doc/{plan_id} como fallback.
Esto permite que el sistema funcione en desarrollo sin credenciales de AWS.
"""

import logging
import os
from io import BytesIO

logger = logging.getLogger(__name__)

_BUCKET  = os.getenv("AWS_S3_BUCKET", "")
_REGION  = os.getenv("AWS_REGION", "us-east-1")
_EXPIRY  = int(os.getenv("S3_PRESIGNED_EXPIRY", 3600))

_DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument"
    ".wordprocessingml.document"
)


def _s3_client():
    import boto3
    return boto3.client("s3", region_name=_REGION)


def _s3_configured() -> bool:
    return bool(os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY") and _BUCKET)


def upload_to_s3(buffer: BytesIO, filename: str) -> str | None:
    """
    Sube `buffer` a S3 bajo la ruta `pdc/{filename}`.
    Devuelve el S3 key (`pdc/{filename}`) si el upload fue exitoso,
    o None si S3 no está configurado o falla el upload.
    """
    if not _s3_configured():
        logger.info("S3 no configurado — usando fallback local.")
        return None

    try:
        from botocore.exceptions import BotoCoreError, ClientError

        key = f"pdc/{filename}"
        buffer.seek(0)
        _s3_client().upload_fileobj(
            buffer,
            _BUCKET,
            key,
            ExtraArgs={"ContentType": _DOCX_MIME},
        )
        return key

    except ImportError:
        logger.warning("boto3 no instalado — fallback local.")
        return None
    except (BotoCoreError, ClientError) as exc:
        logger.error("Error al subir a S3: %s", exc)
        return None


def get_presigned_url(s3_key: str) -> str | None:
    """Genera una URL pre-firmada fresca para un objeto ya existente en S3."""
    if not _s3_configured():
        return None
    try:
        from botocore.exceptions import BotoCoreError, ClientError
        url = _s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": _BUCKET, "Key": s3_key},
            ExpiresIn=_EXPIRY,
        )
        return url
    except Exception as exc:
        logger.error("Error al generar URL pre-firmada: %s", exc)
        return None
