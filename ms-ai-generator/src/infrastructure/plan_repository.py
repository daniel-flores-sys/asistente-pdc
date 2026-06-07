import json
import logging

logger = logging.getLogger(__name__)


def fetch_system_config(conn) -> dict:
    """
    Lee llm_params, rag_params y prompts desde system_config en BD.
    Si la tabla no existe o falla, devuelve {} para que el caller use defaults.
    """
    config = {}
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT clave, valor FROM system_config "
                "WHERE clave IN ('llm_params', 'rag_params', 'prompts')"
            )
            for clave, valor in cur.fetchall():
                # valor puede llegar como dict (JSONB) o como str (TEXT con JSON)
                config[clave] = valor if isinstance(valor, dict) else json.loads(valor)
    except Exception as e:
        # Tabla puede no existir todavía; no romper el flujo principal
        logger.warning("No se pudo leer system_config (usando defaults): %s", e)
    return config


def save_plan(
    conn,
    usuario_id: int,
    anio_escolaridad_id: int,
    trimestre_id: int,
    nombre_docente: str,
    ci_docente: str,
    titulo_docente: str,
    unidad_educativa: str,
    distrito: str,
    nombre_director: str,
    contenido: dict,
) -> int:
    """
    INSERT en plan_curricular con el schema simplificado (sin tablas de persona
    ni asignacion_maestro). El orchestrator ya resolvió todos los datos.
    Devuelve el plan_id generado.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO plan_curricular
                (usuario_id, anio_escolaridad_id, trimestre_id,
                 nombre_docente, ci_docente, titulo_docente,
                 unidad_educativa, distrito, nombre_director, contenido)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                usuario_id, anio_escolaridad_id, trimestre_id,
                nombre_docente, ci_docente, titulo_docente or "",
                unidad_educativa, distrito, nombre_director or "",
                json.dumps(contenido),
            ),
        )
        plan_id = cur.fetchone()[0]
        conn.commit()
        return plan_id
