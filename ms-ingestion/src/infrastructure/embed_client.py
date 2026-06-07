"""
Cliente de embeddings con fallback.
Estrategia: Ollama (nomic-embed-text) → sentence-transformers local.
El fallback local se activa cuando OLLAMA_URL está vacío o Ollama no responde.
"""

import os
import httpx

OLLAMA_URL  = os.getenv("OLLAMA_URL", "")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")

# Modelo local cargado solo si se necesita el fallback (evita ~400 MB en RAM innecesarios)
_local_model = None


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Genera embeddings para una lista de textos.
    Usa Ollama si está disponible; si no, cae al modelo local.
    """
    if OLLAMA_URL:
        try:
            return _embed_via_ollama(texts)
        except Exception:
            # Ollama no disponible → fallback silencioso
            pass
    return _embed_local(texts)


def _embed_via_ollama(texts: list[str]) -> list[list[float]]:
    """Llama a la API de Ollama para generar embeddings uno a uno."""
    embeddings: list[list[float]] = []
    with httpx.Client(timeout=30.0) as client:
        for text in texts:
            resp = client.post(
                f"{OLLAMA_URL}/api/embeddings",
                json={"model": EMBED_MODEL, "prompt": text},
            )
            resp.raise_for_status()
            embeddings.append(resp.json()["embedding"])
    return embeddings


def _embed_local(texts: list[str]) -> list[list[float]]:
    """Genera embeddings con sentence-transformers (all-MiniLM-L6-v2, 384 dims)."""
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        _local_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _local_model.encode(texts).tolist()
