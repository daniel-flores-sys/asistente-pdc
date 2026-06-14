import pytest
from pydantic import ValidationError
from src.domain.schemas.planificacion import GenerateRequest

_UUID1 = '550e8400-e29b-41d4-a716-446655440001'
_UUID2 = '550e8400-e29b-41d4-a716-446655440002'
_UUID3 = '550e8400-e29b-41d4-a716-446655440003'


def test_generate_request_rejects_empty_payload():
    """El schema debe rechazar un payload vacío — todos los campos son requeridos."""
    with pytest.raises(ValidationError):
        GenerateRequest()  # type: ignore


def test_generate_request_rejects_missing_docente():
    """Sin nombre_docente y ci_docente debe fallar la validación."""
    with pytest.raises(ValidationError):
        GenerateRequest(
            anio_escolaridad_id=_UUID1,
            trimestre_id=_UUID2,
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
        usuario_id=_UUID3,
        anio_escolaridad_id=_UUID1,
        trimestre_id=_UUID2,
        areas=[],
        temas={},
        objetivo_holistico="Objetivo de prueba",
    )
    assert req.nombre_docente == "Juan Pérez"
    assert req.anio_escolaridad_id == _UUID1
