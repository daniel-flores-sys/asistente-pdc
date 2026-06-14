from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from src.application.routes.generate import router as generate_router

load_dotenv()

app = FastAPI(
    title="ms-ai-generator",
    description="Generador de Planes de Desarrollo Curricular (PDC) para Bolivia",
    version="1.0.0",
)

# CORS: permite que el frontend y ms-orchestrator llamen a este servicio
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ms-ai-generator"}
