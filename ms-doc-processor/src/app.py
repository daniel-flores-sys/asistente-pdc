"""
src/app.py — Punto de entrada de la aplicación FastAPI.

Registra el router de documentos y expone /health.
La lógica de negocio vive en application/ e infrastructure/.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.application.routes.doc import router

app = FastAPI(
    title="ms-doc-processor",
    description="Genera documentos Word (.docx) de PDC desde la base de datos",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ms-doc-processor"}
