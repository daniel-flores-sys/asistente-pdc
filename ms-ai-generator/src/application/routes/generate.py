import logging
from fastapi import APIRouter, HTTPException

from src.domain.schemas.planificacion import GenerateRequest
from src.infrastructure.db import get_connection
from src.infrastructure import plan_repository as repo
from src.infrastructure.chroma_client import query_rag
from src.infrastructure.ollama_client import generate_with_ollama

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_catalog_context(req: GenerateRequest) -> list[str]:
    """
    Construye contexto pedagogico base desde los catalogos ya seleccionados por el usuario.
    Esto mantiene la generacion util incluso si Chroma aun no esta listo.
    """
    chunks: list[str] = []
    temas = req.temas or {}

    for area in req.areas:
        temas_area = temas.get(str(area.id), [])
        resumen_temas = "; ".join(
            f"semana {tema.semana_num}: {tema.titulo}"
            for tema in temas_area
        ) or "sin temas mensuales registrados"
        chunks.append(
            f"Area curricular {area.nombre} ({area.codigo}). "
            f"Ano de escolaridad {req.anio_escolaridad_id}. "
            f"Trimestre {req.trimestre_id}. "
            f"Temas base: {resumen_temas}."
        )

    if req.objetivo_holistico:
        chunks.append(f"Objetivo holistico base: {req.objetivo_holistico}")

    if req.contexto_social:
        chunks.append(f"Contexto social reportado por el docente: {req.contexto_social}")

    return chunks


@router.post("/generate")
def generate_pdc(req: GenerateRequest):
    """
    Flujo:
    1. Leer llm_params / rag_params / prompts desde system_config en BD
    2. Buscar contexto pedagógico en ChromaDB (RAG) para enriquecer el prompt
    3. Generar PDC con Ollama — si falla o no está configurado, usa mock_data
    4. Persistir en plan_curricular con el nuevo schema simplificado
    5. Devolver { plan_id, contenido }
    """
    conn = get_connection()
    try:
        # 1. Configuración dinámica desde BD (temp, tokens, modelo, system_prompt)
        config = repo.fetch_system_config(conn)

        # 2. RAG: buscar chunks del corpus pedagógico boliviano
        rag_top_k   = int(config.get("rag_params", {}).get("top_k", 5))
        area_nombres = ", ".join(a.nombre for a in req.areas)
        rag_query   = (
            f"planificación curricular {area_nombres} "
            f"año escolaridad {req.anio_escolaridad_id} "
            f"trimestre {req.trimestre_id}"
        )
        rag_chunks = query_rag(rag_query, top_k=rag_top_k)
        catalog_chunks = _build_catalog_context(req)
        rag_chunks = [*catalog_chunks, *rag_chunks]

        # 3. Generar contenido con Ollama (o mock fallback)
        # model_dump() serializa los objetos Pydantic anidados a dicts/listas planas
        req_dict  = req.model_dump()
        contenido = generate_with_ollama(req_dict, rag_chunks, config)

        # 4. Persistir plan con el schema simplificado
        plan_id = repo.save_plan(
            conn,
            usuario_id=req.usuario_id,
            anio_escolaridad_id=req.anio_escolaridad_id,
            trimestre_id=req.trimestre_id,
            nombre_docente=req.nombre_docente,
            ci_docente=req.ci_docente,
            titulo_docente=req.titulo_docente or "",
            unidad_educativa=req.unidad_educativa,
            distrito=req.distrito,
            nombre_director=req.nombre_director or "",
            contenido=contenido,
        )

        return {"plan_id": plan_id, "contenido": contenido}

    except Exception as e:
        conn.rollback()
        logger.error("Error generando PDC: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
