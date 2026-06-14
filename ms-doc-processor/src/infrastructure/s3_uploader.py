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


def upload_to_s3(buffer: BytesIO, filename: str) -> str | None:
    """
    Sube `buffer` a S3 bajo la ruta `pdc/{filename}`.
    Devuelve una URL pre-firmada válida por _EXPIRY segundos,
    o None si S3 no está configurado o falla el upload.
    """
    if not all([
        os.getenv("AWS_ACCESS_KEY_ID"),
        os.getenv("AWS_SECRET_ACCESS_KEY"),
        _BUCKET,
    ]):
        logger.info("S3 no configurado — usando fallback local.")
        return None

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError

        client = boto3.client("s3", region_name=_REGION)
        key = f"pdc/{filename}"

        buffer.seek(0)
        client.upload_fileobj(
            buffer,
            _BUCKET,
            key,
            ExtraArgs={"ContentType": _DOCX_MIME},
        )

        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": _BUCKET, "Key": key},
            ExpiresIn=_EXPIRY,
        )
        return url

    except ImportError:
        logger.warning("boto3 no instalado — fallback local.")
        return None
    except (BotoCoreError, ClientError) as exc:
        logger.error("Error al subir a S3: %s", exc)
        return None
