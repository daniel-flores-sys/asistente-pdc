import os
import psycopg2
import psycopg2.extras

DB_HOST = os.getenv("DB_HOST", "postgres")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME",  "genplan_db")


def get_connection():
    # Leídos en el momento de conectar para no romper el import en tests sin env vars
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME,
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )
