-- =============================================================================
-- Seed adicional: gestión 2026 con sus tres trimestres
-- Ejecutado automáticamente al primer arranque del contenedor postgres.
-- Si los datos ya existen (ON CONFLICT DO NOTHING), no hace nada.
-- =============================================================================

INSERT INTO gestion (anio) VALUES (2026) ON CONFLICT DO NOTHING;

INSERT INTO trimestre (gestion_id, numero, fecha_inicio, fecha_fin)
SELECT id, 1, '2026-02-02', '2026-04-10' FROM gestion WHERE anio = 2026
ON CONFLICT DO NOTHING;

INSERT INTO trimestre (gestion_id, numero, fecha_inicio, fecha_fin)
SELECT id, 2, '2026-04-20', '2026-07-17' FROM gestion WHERE anio = 2026
ON CONFLICT DO NOTHING;

INSERT INTO trimestre (gestion_id, numero, fecha_inicio, fecha_fin)
SELECT id, 3, '2026-07-27', '2026-10-30' FROM gestion WHERE anio = 2026
ON CONFLICT DO NOTHING;
