import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GenerarPDCDto } from '../src/application/controllers/planificacion.controller';

test('GenerarPDCDto rechaza payload vacío', async () => {
  const dto = plainToInstance(GenerarPDCDto, {});
  const errors = await validate(dto);
  assert.ok(errors.length > 0, 'Debe haber errores para payload vacío');
});

test('GenerarPDCDto rechaza payload sin nombre_docente', async () => {
  const dto = plainToInstance(GenerarPDCDto, {
    ci_docente: '1234567',
    unidad_educativa: 'UE Test',
    distrito: 'La Paz',
    anio_escolaridad_id: '550e8400-e29b-41d4-a716-446655440001',
    trimestre_id: '550e8400-e29b-41d4-a716-446655440002',
    areas_seleccionadas: [],
    temas_seleccionados: {},
  });
  const errors = await validate(dto);
  const fields = errors.map((e) => e.property);
  assert.ok(fields.includes('nombre_docente'), 'Debe fallar en nombre_docente');
});

test('GenerarPDCDto acepta payload mínimo válido', async () => {
  const dto = plainToInstance(GenerarPDCDto, {
    nombre_docente: 'Juan Pérez',
    ci_docente: '1234567',
    unidad_educativa: 'UE Test',
    distrito: 'La Paz',
    anio_escolaridad_id: '550e8400-e29b-41d4-a716-446655440001',
    trimestre_id: '550e8400-e29b-41d4-a716-446655440002',
    areas_seleccionadas: [],
    temas_seleccionados: {},
  });
  const errors = await validate(dto);
  assert.strictEqual(errors.length, 0, `No debe haber errores: ${JSON.stringify(errors)}`);
});
