import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { pool } from '../db';

@Injectable()
export class AiGeneratorService {
  private readonly aiUrl: string;
  private readonly docUrl: string;
  private readonly docPublicUrl: string;

  constructor(private configService: ConfigService) {
    this.aiUrl        = this.configService.get<string>('AI_GENERATOR_URL')        ?? 'http://ms-ai-generator:8000';
    this.docUrl       = this.configService.get<string>('DOC_PROCESSOR_URL')       ?? 'http://ms-doc-processor:8001';
    // URL accesible desde el navegador del docente (puede diferir del host Docker interno)
    this.docPublicUrl = this.configService.get<string>('DOC_PROCESSOR_PUBLIC_URL') ?? 'http://localhost:8001';
  }

  async generatePDC(payload: Record<string, unknown>) {
    const aiPayload = await this.buildAiPayload(payload);

    // Paso 1: ms-ai-generator construye el contenido PDC y lo persiste en plan_curricular
    const genRes = await axios.post(`${this.aiUrl}/generate`, aiPayload, {
      timeout: 120000,  // Mantiene la demo responsiva: si Ollama no responde, el AI cae al mock fallback
    });
    const { plan_id } = genRes.data;

    // Paso 2: ms-doc-processor genera el .docx y lo sube a S3 (o modo local)
    const docRes = await axios.post(
      `${this.docUrl}/doc/${plan_id}/upload`,
      {},
      { timeout: 30000 },
    );
    const { s3_url, fallback_url, filename } = docRes.data;

    // Si S3 no está configurado se usa la URL de descarga directa del doc-processor
    const download_url = s3_url ?? `${this.docPublicUrl}${fallback_url}`;

    // Persistir filename y download_url en plan_curricular para el historial
    // Estas columnas deben existir en el schema (ver 01_schema.sql)
    await pool.query(
      'UPDATE plan_curricular SET filename = $1, download_url = $2 WHERE id = $3',
      [filename, download_url, plan_id],
    );

    return { plan_id, download_url, filename };
  }

  private async buildAiPayload(payload: Record<string, unknown>) {
    const areaIds = payload.areas_seleccionadas as number[];
    const selectedTopics = payload.temas_seleccionados as Record<string, number[]>;
    const anioId = Number(payload.anio_escolaridad_id);
    const trimestreId = Number(payload.trimestre_id);

    if (!Array.isArray(areaIds) || areaIds.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos un area curricular');
    }

    const client = await pool.connect();
    try {
      const anioRes = await client.query(
        'SELECT id, nivel_id, literal FROM anio_escolaridad WHERE id = $1',
        [anioId],
      );
      const anio = anioRes.rows[0];
      if (!anio) {
        throw new BadRequestException(`No existe el anio de escolaridad con id ${anioId}`);
      }

      const trimestreRes = await client.query(
        'SELECT numero FROM trimestre WHERE id = $1',
        [trimestreId],
      );
      const trimestreNum = trimestreRes.rows[0]?.numero;
      if (!trimestreNum) {
        throw new BadRequestException(`No existe el trimestre con id ${trimestreId}`);
      }

      const areasRes = await client.query(
        `
        SELECT id, nombre, codigo, nivel_id
        FROM area_curricular
        WHERE id = ANY($1::int[])
        ORDER BY id
        `,
        [areaIds],
      );
      if (areasRes.rows.length !== areaIds.length) {
        throw new BadRequestException('Una o mas areas seleccionadas no existen');
      }
      const invalidAreas = areasRes.rows.filter((row) => row.nivel_id !== anio.nivel_id);
      if (invalidAreas.length > 0) {
        throw new BadRequestException(
          'Las areas seleccionadas no corresponden al nivel del anio de escolaridad elegido',
        );
      }

      const topicIds = Object.values(selectedTopics ?? {}).flat();
      const temasRes = await client.query(
        `
        SELECT id, area_curricular_id, semana_num, titulo, descripcion
        FROM tema_mes
        WHERE id = ANY($1::int[])
          AND anio_escolaridad_id = $2
          AND trimestre_num = $3
        ORDER BY area_curricular_id, semana_num
        `,
        [topicIds, anioId, trimestreNum],
      );

      const objetivoRes = await client.query(
        `
        SELECT ser, saber, hacer, decidir
        FROM objetivo_holistico
        WHERE anio_escolaridad_id = $1
          AND trimestre_num = $2
        `,
        [anioId, trimestreNum],
      );

      const objetivo = objetivoRes.rows[0];
      if (!objetivo) {
        throw new BadRequestException(
          'No existe objetivo holistico para el anio y trimestre seleccionados. Debes registrar ese dato semilla antes de generar.',
        );
      }

      const temas: Record<string, Array<Record<string, unknown>>> = {};
      for (const row of temasRes.rows) {
        const areaId = String(row.area_curricular_id);
        temas[areaId] ??= [];
        temas[areaId].push({
          semana_num: row.semana_num,
          titulo: row.titulo,
          descripcion: row.descripcion ?? '',
        });
      }

      return {
        nombre_docente: payload.nombre_docente,
        ci_docente: payload.ci_docente,
        titulo_docente: payload.titulo_docente ?? '',
        unidad_educativa: payload.unidad_educativa,
        distrito: payload.distrito,
        nombre_director: payload.nombre_director ?? '',
        usuario_id: payload.usuario_id,
        anio_escolaridad_id: anioId,
        trimestre_id: trimestreId,
        areas: areasRes.rows,
        temas,
        objetivo_holistico: [
          `SER: ${objetivo.ser}`,
          `SABER: ${objetivo.saber}`,
          `HACER: ${objetivo.hacer}`,
          `DECIDIR: ${objetivo.decidir}`,
        ].join('\n'),
        materiales: payload.materiales ?? '',
        contexto_social: payload.contexto_social ?? '',
      };
    } finally {
      client.release();
    }
  }
}

