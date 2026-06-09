"""
Cliente de embeddings.
Usa Ollama (nomic-embed-text). Si no está disponible, lanza RuntimeError explícito.
sentence-transformers fue eliminado para mantener la imagen liviana (~800 MB menos).
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
    raise RuntimeError(
        "Ollama no disponible y el fallback local fue eliminado. "
        "Verificá que OLLAMA_URL esté configurado y Ollama responda."
    )
