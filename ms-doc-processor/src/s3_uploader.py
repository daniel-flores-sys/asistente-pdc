"""
s3_uploader.py — Sube un buffer .docx a AWS S3 y devuelve una URL pre-firmada.

Si las credenciales no están configuradas devuelve None
(el endpoint /upload cae al fallback de descarga directa).
"""

import os
import logging

logger = logging.getLogger(__name__)

_KEY    = os.getenv("AWS_ACCESS_KEY_ID", "")
_SECRET = os.getenv("AWS_SECRET_ACCESS_KEY", "")
_BUCKET = os.getenv("AWS_S3_BUCKET", "")
_REGION = os.getenv("AWS_REGION", "us-east-1")
_EXPIRY = int(os.getenv("S3_PRESIGNED_EXPIRY", "3600"))  # segundos


def upload_to_s3(buffer, filename: str) -> str | None:
    """
    Sube buffer (BytesIO) a S3 bajo la clave pdc/{filename}.
    Devuelve una URL pre-firmada válida por _EXPIRY segundos, o None si falla.
    """
    if not _KEY or not _SECRET or not _BUCKET:
        logger.info("Credenciales S3 no configuradas — usando fallback local")
        return None

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError

        s3 = boto3.client(
            "s3",
            region_name=_REGION,
            aws_access_key_id=_KEY,
            aws_secret_access_key=_SECRET,
        )

        key = f"pdc/{filename}"
        buffer.seek(0)
        s3.upload_fileobj(
            buffer,
            _BUCKET,
            key,
            ExtraArgs={
                "ContentType": (
                    "application/vnd.openxmlformats-officedocument"
                    ".wordprocessingml.document"
                )
            },
        )

        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": _BUCKET, "Key": key},
            ExpiresIn=_EXPIRY,
        )
        logger.info("Subido a S3: %s", key)
        return url

    except ImportError:
        logger.warning("boto3 no instalado — S3 no disponible")
        return None
    except Exception as e:
        logger.error("Error al subir a S3: %s", e)
        return None
