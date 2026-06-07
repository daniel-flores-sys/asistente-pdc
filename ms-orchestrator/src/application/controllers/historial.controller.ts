import {
  Controller, Get, Param, ParseIntPipe,
  UseGuards, Request, HttpException, HttpStatus,
} from '@nestjs/common';
import { pool }         from '../../infrastructure/db';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';

@Controller('api/historial')
export class HistorialController {

  @Get()
  @UseGuards(JwtAuthGuard)
  async getHistorial(@Request() req) {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT
          pc.id,
          pc.numero_plan,
          pc.nombre_docente,
          pc.unidad_educativa,
          pc.distrito,
          pc.creado_en,
          ae.literal   AS anio_literal,
          ae.numero    AS anio_numero,
          ne.nombre    AS nivel_nombre,
          t.numero     AS trimestre_numero,
          g.anio       AS gestion_anio
        FROM plan_curricular pc
        JOIN anio_escolaridad ae ON ae.id = pc.anio_escolaridad_id
        JOIN nivel_educativo  ne ON ne.id = ae.nivel_id
        JOIN trimestre         t ON t.id  = pc.trimestre_id
        JOIN gestion            g ON g.id = t.gestion_id
        WHERE pc.usuario_id = $1
        ORDER BY pc.creado_en DESC
      `, [req.user.sub]);
      return res.rows;
    } finally {
      client.release();
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getPlan(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT * FROM plan_curricular WHERE id = $1 AND usuario_id = $2`,
        [id, req.user.sub],
      );
      if (!res.rows[0]) {
        throw new HttpException({ error: 'Plan no encontrado' }, HttpStatus.NOT_FOUND);
      }
      return res.rows[0];
    } finally {
      client.release();
    }
  }
}
