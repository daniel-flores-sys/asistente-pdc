from pydantic import BaseModel
from typing import Optional


class TemaItem(BaseModel):
    trimestre_num: int
    titulo: str
    descripcion: Optional[str] = ""


class AreaItem(BaseModel):
    id: str
    nombre: str
    codigo: str


class GenerateRequest(BaseModel):
    # Datos del docente — ya resueltos por el orchestrator
    nombre_docente: str
    ci_docente: str
    titulo_docente: Optional[str] = ""
    unidad_educativa: str
    distrito: str
    nombre_director: Optional[str] = ""

    # UUIDs de BD enviados por el orchestrator para persistencia
    usuario_id: str
    anio_escolaridad_id: str
    trimestre_id: str

    # Áreas y temas ya resueltos (nombres y contenido) por el orchestrator
    areas: list[AreaItem]
    temas: dict[str, list[TemaItem]]  # "area_uuid" -> [TemaItem, ...]

    # Contenido pedagógico
    objetivo_holistico: str
    materiales: Optional[str] = ""
    contexto_social: Optional[str] = ""


# ── Modelos del JSONB que ms-doc-processor/main.py espera ────────────────────

class SemanaSchema(BaseModel):
    numero: int
    tema: str | list[str]
    practica: str
    teoria: str
    valoracion: str
    produccion: str
    materiales: list[str]


class CriteriosEvaluacion(BaseModel):
    ser: str
    saber: str
    hacer: str


class AreaSchema(BaseModel):
    nombre: str
    codigo: str
    carga_horaria: str
    objetivo_aprendizaje: str
    semanas: list[SemanaSchema]
    criterios_evaluacion: CriteriosEvaluacion
    adaptaciones_curriculares: str


class PDCContenido(BaseModel):
    areas: list[AreaSchema]
