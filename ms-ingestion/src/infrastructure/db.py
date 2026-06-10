"""
Pool de conexiones PostgreSQL (asyncpg).
Se inicializa una sola vez al arrancar la aplicación (lifespan de FastAPI)
y se cierra limpiamente al apagar el servicio.
"""

import asyncio
import os

import asyncpg

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    """Crea el pool al inicio de la aplicación."""
    global _pool
    host_candidates = [
        os.getenv("DB_HOST", "postgres"),
        "pdc_postgres",
        "postgres",
    ]
    last_error: Exception | None = None

    # Swarm puede tardar unos segundos en resolver DNS o aceptar conexiones.
    # Reintentamos para evitar que el contenedor muera en el arranque y deje
    # al orchestrator sin upstream para /api/admin/documentos.
    for attempt in range(10):
        for host in host_candidates:
            try:
                _pool = await asyncpg.create_pool(
                    host=host,
                    port=int(os.getenv("DB_PORT", "5432")),
                    database=os.getenv("DB_NAME", "pdc"),
                    user=os.getenv("DB_USER", "pdc_user"),
                    password=os.getenv("DB_PASSWORD", ""),
                    min_size=2,
                    max_size=10,
                )
                return
            except Exception as exc:
                last_error = exc

        await asyncio.sleep(2)

    raise RuntimeError(f"No se pudo conectar a PostgreSQL tras reintentos: {last_error}")


async def close_pool() -> None:
    """Cierra el pool al apagar la aplicación."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Pool de base de datos no inicializado.")
    return _pool
