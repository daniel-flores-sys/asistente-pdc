"""
mock_data.py — Generador mock de PDC para la fase de demo.

Devuelve el JSONB en el formato exacto que ms-doc-processor/main.py
espera en plan_curricular.contenido:
  { "areas": [ { nombre, codigo, carga_horaria, objetivo_aprendizaje,
                 semanas, criterios_evaluacion, adaptaciones_curriculares } ] }

Cuando Ollama/Gemma esté disponible, reemplazar build_mock_pdc()
por la llamada real al LLM. La firma permanece idéntica.
"""

# Carga horaria semanal por código de área — fuente: currículum Primario SEP Bolivia
CARGA_HORARIA = {
    "VER": "2 clases de 40 minutos a la semana",
    "CL":  "9 clases de 40 minutos a la semana",
    "CS":  "3 clases de 40 minutos a la semana",
    "APV": "2 clases de 40 minutos a la semana",
    "EM":  "2 clases de 40 minutos a la semana",
    "EFD": "3 clases de 40 minutos a la semana",
    "CN":  "4 clases de 40 minutos a la semana",
    "MAT": "7 clases de 40 minutos a la semana",
    "TT":  "4 clases de 40 minutos a la semana",
}


def _build_semanas(
    area_nombre: str,
    temas: list[dict],
    materiales_ctx: str,
) -> list[dict]:
    """
    Construye las 4 semanas del plan para un área.
    temas: lista de {semana_num, titulo, descripcion} provenientes de la BD.
    """
    mats_base = ["Texto de aprendizaje", "Cuaderno de apuntes", "Lápiz negro"]
    mats_extra = [m.strip() for m in materiales_ctx.split(",") if m.strip()]

    semanas = []
    for n in range(1, 5):
        t = next((x for x in temas if x["semana_num"] == n), None)
        titulo = t["titulo"] if t else f"Contenido semana {n} de {area_nombre}"
        desc   = t["descripcion"] if t else ""

        semanas.append({
            "numero": n,
            "tema": titulo,
            "practica": (
                f"Observación y diálogo sobre {titulo.lower()} "
                f"mediante ejemplos del entorno comunitario. {desc}"
            ).strip(),
            "teoria": (
                f"Conceptualización y análisis de {titulo.lower()} "
                f"a partir del texto de aprendizaje oficial."
            ),
            "valoracion": (
                f"Reflexión sobre la importancia de {titulo.lower()} "
                f"para la convivencia comunitaria y el cuidado de la Madre Tierra."
            ),
            "produccion": (
                f"Elaboración de actividades escritas y/o prácticas sobre "
                f"{titulo.lower()} en el cuaderno de trabajo."
            ),
            "materiales": mats_base + mats_extra,
        })
    return semanas


def build_mock_pdc(
    areas_data: list[dict],
    temas_data: dict[int, list],
    materiales: str,
    contexto_social: str,
) -> dict:
    """
    Construye el dict JSONB completo en el formato que main.py espera.

    Parámetros:
      areas_data    — [{id, nombre, codigo}] desde area_curricular en BD
      temas_data    — {area_id: [{semana_num, titulo, descripcion}]} desde tema_mes en BD
      materiales    — texto libre del docente
      contexto_social — texto libre del docente
    """
    ctx = contexto_social or "contexto boliviano plurinacional"
    areas_list = []

    for area in areas_data:
        codigo = area.get("codigo", "")
        carga  = CARGA_HORARIA.get(codigo, "2 clases de 40 minutos a la semana")
        temas  = temas_data.get(area["id"], [])

        areas_list.append({
            "nombre": area["nombre"],
            "codigo": codigo,
            "carga_horaria": carga,
            "objetivo_aprendizaje": (
                f"Comprender los contenidos fundamentales de {area['nombre']}, "
                f"mediante el análisis crítico y la exploración del entorno "
                f"comunitario ({ctx}), para desarrollar el pensamiento reflexivo "
                f"y asumir con responsabilidad los deberes escolares y comunitarios."
            ),
            "semanas": _build_semanas(area["nombre"], temas, materiales or ""),
            "criterios_evaluacion": {
                "ser": (
                    f"Demuestra responsabilidad y respeto hacia sus compañeros "
                    f"en las actividades de {area['nombre']}."
                ),
                "saber": (
                    f"Identifica y describe los conceptos fundamentales de "
                    f"{area['nombre']} según los contenidos del trimestre."
                ),
                "hacer": (
                    f"Completa con limpieza y puntualidad las actividades y "
                    f"ejercicios propuestos en {area['nombre']}."
                ),
            },
            "adaptaciones_curriculares": (
                "No se tienen estudiantes con dificultades de aprendizaje "
                "ni otro caso especial en el presente periodo."
            ),
        })

    return {"areas": areas_list}
