import { Injectable } from '@nestjs/common';
import { pool } from '../db';

@Injectable()
export class ReferenceDataService {

  async getReferenceData() {
    const client = await pool.connect();
    try {
      // Queries en paralelo para minimizar latencia
      // unidad_educativa eliminada — el docente la ingresa como texto libre
      const [niveles, anios, areas, trimestres, temas, objetivos] = await Promise.all([
        client.query('SELECT id, nombre FROM nivel_educativo ORDER BY id'),
        client.query(`
          SELECT ae.id, ae.nivel_id, ae.numero, ae.literal,
                 ne.nombre AS nivel_nombre
          FROM anio_escolaridad ae
          JOIN nivel_educativo ne ON ne.id = ae.nivel_id
          ORDER BY ae.nivel_id, ae.numero
        `),
        client.query(`
          SELECT id, nivel_id, nombre, codigo
          FROM area_curricular
          ORDER BY nivel_id, id
        `),
        client.query(`
          SELECT t.id, t.gestion_id, t.numero,
                 t.fecha_inicio, t.fecha_fin,
                 g.anio AS gestion_anio
          FROM trimestre t
          JOIN gestion g ON g.id = t.gestion_id
          ORDER BY g.anio DESC, t.numero
        `),
        client.query(`
          SELECT id, area_curricular_id, anio_escolaridad_id,
                 trimestre_num, semana_num, titulo, descripcion
          FROM tema_mes
          ORDER BY area_curricular_id, trimestre_num, semana_num
        `),
        client.query(`
          SELECT id, anio_escolaridad_id, trimestre_num,
                 ser, saber, hacer, decidir
          FROM objetivo_holistico
          ORDER BY anio_escolaridad_id, trimestre_num
        `),
      ]);

      return {
        niveles_educativos:   niveles.rows,
        anios_escolaridad:    anios.rows,
        areas_curriculares:   areas.rows,
        trimestres:           trimestres.rows,
        temas_mes:            temas.rows,
        objetivos_holisticos: objetivos.rows,
      };
    } finally {
      client.release();
    }
  }
}
