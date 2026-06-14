import {
  Controller, Get, Param, ParseUUIDPipe,
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
          pc.id                AS plan_id,
          pc.unidad_educativa,
          pc.creado_en         AS fecha,
          pc.filename,
          pc.download_url,
          t.numero             AS trimestre,
          g.anio               AS gestion_anio,
          ae.literal           AS anio_literal,
          ne.nombre            AS nivel_nombre
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
  async getPlan(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
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
