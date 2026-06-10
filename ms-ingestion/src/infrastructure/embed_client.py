"""
Cliente de embeddings.
Usa Ollama cuando esta disponible. Si falla, cae a un embedding local
deterministico para no bloquear la demo ni la ingesta administrativa.
"""

import hashlib
import math
import os

import httpx

OLLAMA_URL = os.getenv("OLLAMA_URL", "")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
LOCAL_DIM = 256


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Genera embeddings para una lista de textos.
    Usa Ollama si esta disponible; si no, cae a un embedding local estable.
    """
    if OLLAMA_URL:
        try:
            return _embed_via_ollama(texts)
        except Exception:
            # Si el modelo de embeddings no existe o Ollama no responde,
            # seguimos con un vector local para no cortar la demo.
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
    return [_hash_embedding(text) for text in texts]


def _hash_embedding(text: str) -> list[float]:
    tokens = [tok for tok in text.lower().split() if tok]
    vector = [0.0] * LOCAL_DIM

    if not tokens:
        return vector

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:2], "big") % LOCAL_DIM
        sign = 1.0 if digest[2] % 2 == 0 else -1.0
        weight = 1.0 + (digest[3] / 255.0)
        vector[idx] += sign * weight

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector

    return [value / norm for value in vector]
