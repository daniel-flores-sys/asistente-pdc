import os
import logging
import chromadb

logger = logging.getLogger(__name__)

CHROMA_HOST       = os.getenv("CHROMA_HOST",       "chromadb")
CHROMA_PORT       = int(os.getenv("CHROMA_PORT",   "8000"))
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "curriculum_pdc")


def query_rag(query_text: str, top_k: int = 5) -> list[str]:
    """
    Busca los chunks más relevantes en ChromaDB para el query dado.
    Devuelve lista de strings listos para insertar en el prompt del LLM.
    Si ChromaDB no está disponible, devuelve [] y el generador continúa sin RAG.
    """
    try:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        collection = client.get_collection(CHROMA_COLLECTION)
        results = collection.query(
            query_texts=[query_text],
            n_results=top_k,
        )
        # results["documents"] tiene forma [[doc1, doc2, ...]] (una lista por query)
        return results["documents"][0] if results.get("documents") else []
    except Exception as e:
        logger.warning("ChromaDB no disponible, generando sin RAG: %s", e)
        return []
