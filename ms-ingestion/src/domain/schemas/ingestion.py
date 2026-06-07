from datetime import datetime
from pydantic import BaseModel


class IngestResponse(BaseModel):
    documento_id: int
    coleccion: str
    archivo: str
    tipo: str
    chunks_generados: int
    mensaje: str


class DocumentoRecord(BaseModel):
    id: int
    nombre_archivo: str
    tipo: str
    chunks_generados: int
    chroma_ids: list[str]
    estado: str
    subido_por: int
    creado_en: datetime


class DeleteResponse(BaseModel):
    mensaje: str


class ReindexResponse(BaseModel):
    mensaje: str


class CollectionInfo(BaseModel):
    nombre: str
    total_documentos: int
