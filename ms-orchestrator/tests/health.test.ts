// Obligatorio antes de cualquier import de NestJS: habilita los metadatos de decoradores
import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlanificacionController } from '../src/application/controllers/planificacion.controller';

test('health() devuelve status ok', () => {
  // Los tres servicios son null porque health() no los usa
  const ctrl = new PlanificacionController(null as any, null as any, null as any);
  const result = ctrl.health();
  assert.strictEqual(result.status, 'ok');
});

test('health() devuelve el nombre correcto del servicio', () => {
  const ctrl = new PlanificacionController(null as any, null as any, null as any);
  const result = ctrl.health();
  assert.strictEqual(result.service, 'ms-orchestrator');
});
