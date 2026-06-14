"""
main.py — CLI para generar documentos PDC desde la línea de comandos.

Uso:
    python main.py              # usa PLAN_ID del .env
    python main.py --plan-id 3  # especifica el plan directamente

Este archivo solo orquesta el flujo CLI. Toda la lógica vive en src/:
  - src/infrastructure/plan_repository.py  → consulta a la BD
  - src/application/services/doc_builder.py → construcción del Word
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv()

from src.infrastructure.plan_repository import fetch_plan
from src.application.services.doc_builder import build_document

OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "./output"))


def main():
    parser = argparse.ArgumentParser(
        description="Genera el PDC en formato Word desde la base de datos."
    )
    parser.add_argument(
        "--plan-id", type=int,
        default=int(os.getenv("PLAN_ID", 1)),
        help="ID del plan_curricular a exportar",
    )
    args = parser.parse_args()

    print(f"[PDC] Generando plan #{args.plan_id} ...")

    try:
        plan = fetch_plan(args.plan_id)
    except psycopg2.OperationalError as exc:
        print(f"[ERROR] No se pudo conectar a la base de datos:\n  {exc}")
        sys.exit(1)
    except ValueError as exc:
        print(f"[ERROR] {exc}")
        sys.exit(1)

    print(
        f"[PDC] Plan encontrado: Nº{plan.numero_plan} — "
        f"{plan.unidad_educativa} — {plan.anio_escolaridad} — "
        f"Trimestre {plan.trimestre} — {plan.gestion}"
    )

    doc = build_document(plan.model_dump())

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = (
        f"PDC_{plan.unidad_educativa.replace(' ', '_')}_"
        f"{plan.anio_escolaridad.replace(' ', '_')}_"
        f"T{plan.trimestre}_P{plan.numero_plan}_"
        f"{plan.gestion}_{timestamp}.docx"
    )
    output_path = OUTPUT_DIR / filename
    doc.save(output_path)
    print(f"[PDC] Documento guardado en: {output_path}")


if __name__ == "__main__":
    main()
