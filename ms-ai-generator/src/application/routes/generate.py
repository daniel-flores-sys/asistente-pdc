import logging
from fastapi import APIRouter, HTTPException

from src.domain.schemas.planificacion import GenerateRequest
from src.infrastructure.db import get_connection
from src.infrastructure import plan_repository as repo
from src.infrastructure.chroma_client import query_rag
from src.infrastructure.ollama_client import generate_with_ollama
from src.infrastructure.mock_data import build_mock_pdc

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate")
def generate_pdc(req: GenerateRequest):
    """
    Flujo:
    1. Leer llm_params / rag_params / prompts desde system_config en BD
    2. Buscar contexto pedagógico en ChromaDB (RAG) para enriquecer el prompt
    3. Generar PDC con Ollama; si falla (timeout 120s), usar mock_data como fallback
    4. Persistir en plan_curricular
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

        # 3. Generar contenido con Ollama; si falla (timeout, server caído)
        #    usar mock determinístico para que el flujo siempre complete.
        req_dict = req.model_dump()
        try:
            contenido = generate_with_ollama(req_dict, rag_chunks, config)
        except Exception as ollama_err:
            logger.warning("Ollama no disponible (%s) — usando mock fallback", ollama_err)
            areas_data = [{"id": a.id, "nombre": a.nombre, "codigo": a.codigo} for a in req.areas]
            temas_data = {
                str(area_id): [
                    {"semana_num": t["trimestre_num"], "titulo": t["titulo"], "descripcion": t.get("descripcion", "")}
                    for t in temas_list
                ]
                for area_id, temas_list in req.temas.items()
            }
            contenido = build_mock_pdc(
                areas_data=areas_data,
                temas_data=temas_data,
                materiales=req.materiales or "",
                contexto_social=req.contexto_social or "",
            )

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
