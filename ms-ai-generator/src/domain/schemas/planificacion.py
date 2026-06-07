from pydantic import BaseModel
from typing import Optional


class TemaItem(BaseModel):
    semana_num: int
    titulo: str
    descripcion: Optional[str] = ""


class AreaItem(BaseModel):
    id: int
    nombre: str
    codigo: str


class GenerateRequest(BaseModel):
    # Datos del docente — ya resueltos por el orchestrator, no IDs
    nombre_docente: str
    ci_docente: str
    titulo_docente: Optional[str] = ""
    unidad_educativa: str
    distrito: str
    nombre_director: Optional[str] = ""

    # Referencias a BD enviadas directas desde el orchestrator
    usuario_id: int
    anio_escolaridad_id: int
    trimestre_id: int

    # Áreas y temas ya resueltos por el orchestrator desde BD
    areas: list[AreaItem]
    temas: dict[str, list[TemaItem]]  # "area_id" -> [TemaItem, ...]

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
