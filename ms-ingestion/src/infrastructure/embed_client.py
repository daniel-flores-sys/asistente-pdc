"""
Cliente de embeddings.
Estrategia: Ollama (nomic-embed-text) si disponible; si no, fallback hash-determinístico.

El fallback no produce embeddings semánticos reales pero permite que ChromaDB almacene
los vectores y el pipeline de ingestión complete sin errores. Es suficiente para la demo.
sentence-transformers fue eliminado intencionalmente para mantener la imagen liviana.
"""

import hashlib
import math
import os

import httpx

OLLAMA_URL  = os.getenv("OLLAMA_URL", "")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")

# nomic-embed-text usa 768 dimensiones; el fallback debe coincidir para
# no romper colecciones ChromaDB creadas con el modelo real.
_EMBED_DIM = 768


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Genera embeddings para una lista de textos.
    Usa Ollama si está disponible; si no, cae al fallback hash-determinístico.
    """
    if OLLAMA_URL:
        try:
            return _embed_via_ollama(texts)
        except Exception:
            # Ollama no disponible → fallback silencioso al método local
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
    """
    Fallback deterministico sin dependencias externas.
    Genera vectores de _EMBED_DIM dimensiones usando SHA-512 del texto.
    No son embeddings semánticos — el RAG no será preciso, pero el pipeline funciona.
    """
    results: list[list[float]] = []
    for text in texts:
        values: list[float] = []
        # Generamos bloques de 64 bytes con semillas distintas hasta cubrir _EMBED_DIM floats
        seed = 0
        while len(values) < _EMBED_DIM:
            block = hashlib.sha512(f"{seed}:{text}".encode()).digest()
            values.extend(b / 255.0 - 0.5 for b in block)
            seed += 1
        values = values[:_EMBED_DIM]
        # Normalizar a vector unitario (cosine similarity requiere vectores normalizados)
        magnitude = math.sqrt(sum(v * v for v in values))
        if magnitude > 0:
            values = [v / magnitude for v in values]
        results.append(values)
    return results
