"""
domain/schemas/plan.py — Modelo tipado del plan leído desde la base de datos.

PlanData representa exactamente las columnas que devuelve la consulta SQL_PLAN
en plan_repository.py. Cualquier cambio en el SELECT debe reflejarse aquí.
"""

from __future__ import annotations
from datetime import date
from typing import Any
from pydantic import BaseModel


class PlanData(BaseModel):
    id: int
    numero_plan: int
    # Fechas vienen de trimestre (antes eran columnas propias del plan)
    fecha_inicio: date
    fecha_fin: date
    trimestre: int
    gestion: int
    anio_escolaridad: str
    # Campos desnormalizados: el orquestador los guarda directamente en plan_curricular
    nombre_docente:  str | None = None
    ci_docente:      str | None = None
    titulo_docente:  str | None = None
    unidad_educativa: str | None = None
    distrito:        str | None = None
    nombre_director: str | None = None
    # contenido es el JSONB con la estructura de áreas, semanas y momentos
    contenido: Any
