"""
infrastructure/plan_repository.py — Acceso a datos del plan curricular.

fetch_plan() lee las 3 tablas necesarias y devuelve un PlanData tipado.
Los datos del docente, unidad y director viven directamente en plan_curricular;
ya no se necesitan JOINs a las tablas normalizadas que fueron eliminadas.
"""

import psycopg2.extras

from src.infrastructure.db import get_connection
from src.domain.schemas.plan import PlanData


# Los campos del encabezado (docente, unidad, director) son columnas directas
# en plan_curricular; solo se necesitan JOINs para anio_escolaridad, trimestre
# y gestion (datos que siguen normalizados).
SQL_PLAN = """
SELECT
    pc.id,
    pc.numero_plan,
    pc.nombre_docente,
    pc.ci_docente,
    pc.titulo_docente,
    pc.unidad_educativa,
    pc.distrito,
    pc.nombre_director,
    pc.contenido,
    ae.literal  AS anio_escolaridad,
    t.numero    AS trimestre,
    t.fecha_inicio,
    t.fecha_fin,
    g.anio      AS gestion
FROM plan_curricular  pc
JOIN anio_escolaridad ae ON ae.id = pc.anio_escolaridad_id
JOIN trimestre        t  ON t.id  = pc.trimestre_id
JOIN gestion          g  ON g.id  = t.gestion_id
WHERE pc.id = %s
"""


def fetch_plan(plan_id: str) -> PlanData:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(SQL_PLAN, (plan_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"No se encontró el plan con id={plan_id}")
            return PlanData(**dict(row))
    finally:
        conn.close()
