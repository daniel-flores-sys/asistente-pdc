"""
Pool de conexiones PostgreSQL (asyncpg).
Se inicializa una sola vez al arrancar la aplicación (lifespan de FastAPI)
y se cierra limpiamente al apagar el servicio.
"""

import os
import asyncpg

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    """Crea el pool al inicio de la aplicación."""
    global _pool
    _pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST", "postgres"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "pdc"),
        user=os.getenv("DB_USER", "pdc_user"),
        password=os.getenv("DB_PASSWORD", ""),
        min_size=2,
        max_size=10,
    )


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
