"""
Repositorio de documentos indexados en PostgreSQL.
Encapsula todas las operaciones SQL sobre la tabla documentos_indexados,
siguiendo el principio SRP: este módulo solo sabe de persistencia, no de lógica.
"""

from src.infrastructure.db import get_pool


async def insert_documento(
    nombre_archivo: str,
    tipo: str,
    chunks_generados: int,
    chroma_ids: list[str],
    subido_por: str | None = None,
) -> str:
    """Registra un documento recién indexado. Retorna el id generado."""
    pool = get_pool()

    # Convertir subido_por al tipo que espera la BD:
    # BD nueva (UUID): pasa como string; BD antigua (SERIAL): convierte a int.
    # Si no es ni UUID ni entero, omite el campo para evitar error de tipo.
    sp: int | str | None = None
    if subido_por is not None:
        if subido_por.isdigit():
            sp = int(subido_por)
        else:
            sp = subido_por  # asume UUID u otro formato válido

    try:
        row = await pool.fetchrow(
            """
            INSERT INTO documentos_indexados
                (nombre_archivo, tipo, chunks_generados, chroma_ids, estado, subido_por, creado_en)
            VALUES ($1, $2, $3, $4::TEXT[], 'indexado', $5, NOW())
            RETURNING id
            """,
            nombre_archivo, tipo, chunks_generados, chroma_ids, sp,
        )
    except Exception:
        # Fallback: si subido_por causa error de tipo, insertar sin él
        row = await pool.fetchrow(
            """
            INSERT INTO documentos_indexados
                (nombre_archivo, tipo, chunks_generados, chroma_ids, estado, creado_en)
            VALUES ($1, $2, $3, $4::TEXT[], 'indexado', NOW())
            RETURNING id
            """,
            nombre_archivo, tipo, chunks_generados, chroma_ids,
        )

    return str(row["id"])


async def update_estado(doc_id: str, estado: str) -> None:
    """Actualiza el campo estado de un documento (ej. 'eliminado', 'error')."""
    pool = get_pool()
    await pool.execute(
        "UPDATE documentos_indexados SET estado = $1 WHERE id = $2",
        estado,
        doc_id,
    )


async def get_chroma_ids_by_id(doc_id: str) -> list[str] | None:
    """Devuelve los chroma_ids del documento, o None si no existe."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT chroma_ids FROM documentos_indexados WHERE id = $1",
        doc_id,
    )
    if row is None:
        return None
    return list(row["chroma_ids"])


async def get_all_active() -> list[dict]:
    """Lista todos los documentos que no han sido eliminados."""
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT id, nombre_archivo, tipo, chunks_generados,
               chroma_ids, estado, subido_por, creado_en
        FROM documentos_indexados
        WHERE estado != 'eliminado'
        ORDER BY creado_en DESC
        """
    )
    result = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        if d.get("subido_por") is not None:
            d["subido_por"] = str(d["subido_por"])
        result.append(d)
    return result
