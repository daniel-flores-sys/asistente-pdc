import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from src.application.routes.monitor import router as monitor_router
from src.infrastructure.docker_client import is_swarm_active
from src.monitor_loop import monitor_loop

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicia el loop de monitoreo como tarea de background al arrancar
    task = asyncio.create_task(monitor_loop())
    yield
    task.cancel()


app = FastAPI(
    title="ms-monitor",
    description="Monitoreo y auto-scaling del stack PDC en Docker Swarm",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(monitor_router)


@app.get("/health")
def health():
    swarm = is_swarm_active()
    return {
        "status": "ok",
        "service": "ms-monitor",
        "swarm_active": swarm,
        "environment": os.getenv("ENVIRONMENT", "development"),
    }
