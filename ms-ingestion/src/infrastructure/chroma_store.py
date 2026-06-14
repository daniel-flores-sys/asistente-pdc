"""
Cliente ChromaDB HTTP.
Conecta al servidor ChromaDB que corre como contenedor separado en el Swarm.
Los embeddings son siempre generados externamente (embed_client) y pasados
aquí explícitamente, de modo que ChromaDB no necesita su propia función de embedding.
"""

import os
import uuid
import chromadb

CHROMA_HOST        = os.getenv("CHROMA_HOST",       "chromadb")
CHROMA_PORT        = int(os.getenv("CHROMA_PORT",   "8004"))
DEFAULT_COLLECTION = os.getenv("CHROMA_COLLECTION", "curriculum_pdc")


def _get_client() -> chromadb.HttpClient:
    return chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)


def _get_or_create_collection(client: chromadb.HttpClient, nombre: str):
    """
    Crea o recupera una colección sin función de embedding incorporada.
    Los embeddings se inyectan desde fuera para poder usar Ollama/nomic-embed-text.
    """
    return client.get_or_create_collection(
        name=nombre,
        metadata={"hnsw:space": "cosine"},
    )


def store_chunks(
    chunks: list[str],
    metadatas: list[dict],
    embeddings: list[list[float]],
    coleccion: str = DEFAULT_COLLECTION,
) -> list[str]:
    """
    Almacena los chunks en ChromaDB con sus embeddings y metadatos.
    Retorna la lista de IDs generados (necesarios para poder eliminar luego).
    """
    client     = _get_client()
    collection = _get_or_create_collection(client, coleccion)

    ids = [str(uuid.uuid4()) for _ in chunks]
    collection.add(
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )
    return ids


def delete_chunks(coleccion: str, ids: list[str]) -> None:
    """Elimina de ChromaDB los vectores identificados por sus IDs."""
    client     = _get_client()
    collection = _get_or_create_collection(client, coleccion)
    collection.delete(ids=ids)


def list_collections() -> list[dict]:
    """Lista todas las colecciones disponibles con su conteo de documentos."""
    client      = _get_client()
    collections = client.list_collections()
    result = []
    for col in collections:
        c = client.get_collection(col.name)
        result.append({"nombre": col.name, "total_documentos": c.count()})
    return result


def health_check() -> bool:
    """Devuelve True si ChromaDB responde correctamente."""
    try:
        client = _get_client()
        client.heartbeat()
        return True
    except Exception:
        return False
