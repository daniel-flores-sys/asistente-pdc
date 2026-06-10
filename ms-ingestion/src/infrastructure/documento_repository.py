"""
Repositorio de documentos indexados en PostgreSQL.
Encapsula todas las operaciones SQL sobre la tabla documentos_indexados.
"""

from src.infrastructure.db import get_pool


async def insert_documento(
    nombre_archivo: str,
    tipo: str,
    chunks_generados: int,
    chroma_ids: list[str],
    subido_por: int = 1,
    estado: str = "indexado",
) -> int:
    """Registra un documento y retorna el id generado."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO documentos_indexados
            (nombre_archivo, tipo, chunks_generados, chroma_ids, estado, subido_por, creado_en)
        VALUES ($1, $2, $3, $4::TEXT[], $5, $6, NOW())
        RETURNING id
        """,
        nombre_archivo,
        tipo,
        chunks_generados,
        chroma_ids,
        estado,
        subido_por,
    )
    return row["id"]


async def update_estado(doc_id: int, estado: str) -> None:
    """Actualiza el estado de un documento."""
    pool = get_pool()
    await pool.execute(
        "UPDATE documentos_indexados SET estado = $1 WHERE id = $2",
        estado,
        doc_id,
    )


async def get_chroma_ids_by_id(doc_id: int) -> list[str] | None:
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
    return [dict(r) for r in rows]
