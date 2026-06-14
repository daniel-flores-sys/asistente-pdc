import pytest
from pydantic import ValidationError
from src.domain.schemas.planificacion import GenerateRequest


def test_generate_request_rejects_empty_payload():
    """El schema debe rechazar un payload vacío — todos los campos son requeridos."""
    with pytest.raises(ValidationError):
        GenerateRequest()  # type: ignore


def test_generate_request_rejects_missing_docente():
    """Sin nombre_docente y ci_docente debe fallar la validación."""
    with pytest.raises(ValidationError):
        GenerateRequest(
            anio_escolaridad_id=1,
            trimestre_id=1,
            areas=[],
            temas={},
            objetivo_holistico="test",
        )  # type: ignore


def test_generate_request_accepts_minimal_valid():
    """Payload mínimo válido no debe lanzar excepción."""
    req = GenerateRequest(
        nombre_docente="Juan Pérez",
        ci_docente="1234567",
        unidad_educativa="UE Test",
        distrito="La Paz",
        usuario_id=1,
        anio_escolaridad_id=1,
        trimestre_id=1,
        areas=[],
        temas={},
        objetivo_holistico="Objetivo de prueba",
    )
    assert req.nombre_docente == "Juan Pérez"
    assert req.anio_escolaridad_id == 1
