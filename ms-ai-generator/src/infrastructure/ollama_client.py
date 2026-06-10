import os
import json
import logging
import httpx

from src.infrastructure.mock_data import build_mock_pdc

logger = logging.getLogger(__name__)

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")


# ── Construcción del prompt ───────────────────────────────────────────────────

def _build_prompt(req_data: dict, rag_chunks: list[str], config: dict) -> tuple[str, str]:
    """
    Devuelve (system_prompt, user_prompt) usando los datos del request,
    los chunks de RAG y el system_prompt configurado en BD (si existe).
    """
    system_prompt = (
        config.get("prompts", {}).get("system_prompt")
        or (
            "Eres un experto en planificación curricular del sistema educativo "
            "boliviano (Modelo Educativo Sociocomunitario Productivo). "
            "Respondes ÚNICAMENTE con JSON válido, sin markdown, sin texto extra."
        )
    )

    rag_context = ""
    if rag_chunks:
        rag_context = (
            "\n\nCONTEXTO PEDAGÓGICO (usa esto como referencia):\n"
            + "\n---\n".join(rag_chunks[:5])
        )

    areas = req_data["areas"]   # [{id, nombre, codigo}, ...]
    temas = req_data["temas"]   # {"area_id": [{semana_num, titulo, descripcion}], ...}

    areas_desc = []
    for area in areas:
        area_id = str(area["id"])
        temas_area = temas.get(area_id, [])
        temas_str = ", ".join(
            f"Semana {t['semana_num']}: {t['titulo']}" for t in temas_area
        ) or "sin temas definidos"
        areas_desc.append(f"- {area['nombre']} ({area['codigo']}): {temas_str}")

    user_prompt = f"""Genera un Plan de Desarrollo Curricular (PDC) boliviano con este formato JSON exacto:
{{
  "areas": [
    {{
      "nombre": "string",
      "codigo": "string",
      "carga_horaria": "string",
      "objetivo_aprendizaje": "string",
      "semanas": [
        {{
          "numero": 1,
          "tema": "string",
          "practica": "string",
          "teoria": "string",
          "valoracion": "string",
          "produccion": "string",
          "materiales": ["string"]
        }}
      ],
      "criterios_evaluacion": {{
        "ser": "string",
        "saber": "string",
        "hacer": "string"
      }},
      "adaptaciones_curriculares": "string"
    }}
  ]
}}

DATOS DEL PDC:
- Docente: {req_data['nombre_docente']}, {req_data['unidad_educativa']}, {req_data['distrito']}
- Objetivo holístico: {req_data['objetivo_holistico']}
- Materiales disponibles: {req_data.get('materiales') or 'no especificados'}
- Contexto social: {req_data.get('contexto_social') or 'Bolivia plurinacional'}
- Áreas y temas:
{chr(10).join(areas_desc)}
{rag_context}

Genera exactamente {len(areas)} área(s). Cada área debe tener exactamente 4 semanas.
Responde SOLO con el JSON, sin texto adicional."""

    return system_prompt, user_prompt


# ── Llamada a Ollama ──────────────────────────────────────────────────────────

def generate_with_ollama(req_data: dict, rag_chunks: list[str], config: dict) -> dict:
    """
    Genera el contenido del PDC usando Ollama.
    Si OLLAMA_URL está vacío o la llamada falla → mock fallback.

    req_data: dict serializado de GenerateRequest (model_dump())
    Devuelve el dict contenido con la estructura PDCContenido.
    """
    if not OLLAMA_URL:
        logger.info("OLLAMA_URL no configurado — usando mock fallback")
        return _mock_fallback(req_data)

    llm_cfg     = config.get("llm_params", {})
    temperature = float(llm_cfg.get("temperature", 0.7))
    max_tokens  = int(llm_cfg.get("max_tokens",  4096))
    model       = llm_cfg.get("modelo") or OLLAMA_MODEL

    system_prompt, user_prompt = _build_prompt(req_data, rag_chunks, config)

    payload = {
        "model":  model,
        "system": system_prompt,
        "prompt": user_prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    try:
        with httpx.Client(timeout=240.0) as client:
            response = client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            response.raise_for_status()
            raw_response = response.json().get("response", "{}")
            contenido = json.loads(raw_response)
            if "areas" not in contenido:
                raise ValueError("Respuesta del LLM no contiene clave 'areas'")
            logger.info("PDC generado por Ollama con modelo %s", model)
            return contenido
    except Exception as e:
        logger.warning("Ollama falló (%s) — usando mock fallback", e)
        return _mock_fallback(req_data)


# ── Mock fallback ─────────────────────────────────────────────────────────────

def _mock_fallback(req_data: dict) -> dict:
    """
    Construye el PDC desde mock_data cuando Ollama no está disponible.
    Las claves de temas vienen como strings desde model_dump(); se convierten
    a int porque build_mock_pdc indexa por area_id int.
    """
    areas_data = req_data["areas"]   # [{id, nombre, codigo}]
    temas_raw  = req_data["temas"]   # {"area_id_str": [{semana_num, titulo, descripcion}]}
    temas_data = {int(k): v for k, v in temas_raw.items()}

    return build_mock_pdc(
        areas_data=areas_data,
        temas_data=temas_data,
        materiales=req_data.get("materiales") or "",
        contexto_social=req_data.get("contexto_social") or "",
    )
