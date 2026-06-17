import {
  Controller, Get, Param, ParseUUIDPipe,
  UseGuards, Request, HttpException, HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import { pool }         from '../../infrastructure/db';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';

const DOC_URL = process.env.DOC_PROCESSOR_URL ?? 'http://ms-doc-processor:8001';

@Controller('api/historial')
export class HistorialController {

  @Get()
  @UseGuards(JwtAuthGuard)
  async getHistorial(@Request() req) {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT
          pc.id                AS id,
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

  /**
   * Genera una URL de descarga fresca para el plan indicado.
   * Llama al ms-doc-processor para obtener una pre-signed URL renovada
   * sin necesidad de re-subir el archivo.
   */
  @Get(':id/download-url')
  @UseGuards(JwtAuthGuard)
  async getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const client = await pool.connect();
    try {
      const planRes = await client.query(
        'SELECT filename FROM plan_curricular WHERE id = $1 AND usuario_id = $2',
        [id, req.user.sub],
      );
      if (!planRes.rows[0]) {
        return res.status(HttpStatus.NOT_FOUND).json({ error: 'Plan no encontrado' });
      }

      const docRes = await axios.get(
        `${DOC_URL}/doc/${id}/signed-url`,
        { validateStatus: () => true, timeout: 10000 },
      );

      if (docRes.status === 200 && docRes.data.url) {
        return res.json({ url: docRes.data.url, filename: docRes.data.filename });
      }

      // Fallback: URL de descarga directa (el orchestrator hace de proxy)
      return res.json({
        url: `/api/historial/${id}/download`,
        filename: planRes.rows[0].filename,
      });
    } finally {
      client.release();
    }
  }

  /** Proxy de descarga directa cuando S3 no está disponible */
  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  async downloadDirect(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const client = await pool.connect();
    try {
      const planRes = await client.query(
        'SELECT filename FROM plan_curricular WHERE id = $1 AND usuario_id = $2',
        [id, req.user.sub],
      );
      if (!planRes.rows[0]) {
        return res.status(HttpStatus.NOT_FOUND).json({ error: 'Plan no encontrado' });
      }

      const docStream = await axios.get(`${DOC_URL}/doc/${id}`, {
        responseType: 'stream',
        validateStatus: () => true,
        timeout: 30000,
      });

      const filename = planRes.rows[0].filename ?? `PDC_${id}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      docStream.data.pipe(res);
    } finally {
      client.release();
    }
  }
}
