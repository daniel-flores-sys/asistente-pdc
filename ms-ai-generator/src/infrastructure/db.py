import os
import psycopg2
import psycopg2.extras

# Los valores por defecto coinciden con el docker-compose.dev.yml
DB_HOST     = os.getenv("DB_HOST",     "postgres")
DB_PORT     = int(os.getenv("DB_PORT", "5432"))
DB_NAME     = os.getenv("DB_NAME",     "genplan_db")
DB_USER     = os.getenv("DB_USER",     "genplan_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "genplan_pass")


def get_connection():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
    )
