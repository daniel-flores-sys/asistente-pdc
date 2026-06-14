"""
infrastructure/db.py — Fábrica de conexiones a PostgreSQL.

Todas las conexiones del servicio pasan por get_connection() para que
el cambio de credenciales solo requiera editar variables de entorno,
nunca el código.
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_connection() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "postgres"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "genplan_db"),
        user=os.environ["DB_USER"],       # falla explícito si no está configurado
        password=os.environ["DB_PASSWORD"],  # falla explícito si no está configurado
    )
