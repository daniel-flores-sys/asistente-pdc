import { Injectable } from '@nestjs/common';
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
    this.docPublicUrl = this.configService.get<string>('DOC_PROCESSOR_PUBLIC_URL') ?? 'http://localhost:8001';
  }

  async generatePDC(dto: {
    usuario_id: string;
    nombre_docente: string;
    ci_docente: string;
    titulo_docente?: string;
    unidad_educativa: string;
    distrito: string;
    nombre_director?: string;
    anio_escolaridad_id: string;
    trimestre_id: string;
    areas_seleccionadas: string[];
    temas_seleccionados: Record<string, string[]>;
    materiales?: string;
    contexto_social?: string;
  }) {
    const client = await pool.connect();
    try {
      // Resolver en paralelo: objetivo holístico, áreas y temas desde BD
      const allTemaIds = Object.values(dto.temas_seleccionados).flat();

      const [objResult, areasResult, temasResult] = await Promise.all([
        client.query(
          `SELECT ser, saber, hacer, decidir
           FROM objetivo_holistico
           WHERE anio_escolaridad_id = $1
             AND trimestre_num = (SELECT numero FROM trimestre WHERE id = $2)`,
          [dto.anio_escolaridad_id, dto.trimestre_id],
        ),
        client.query(
          'SELECT id, nombre, codigo FROM area_curricular WHERE id = ANY($1::uuid[])',
          [dto.areas_seleccionadas],
        ),
        allTemaIds.length > 0
          ? client.query(
              `SELECT id, area_curricular_id, trimestre_num, titulo, descripcion
               FROM tema_trimestral WHERE id = ANY($1::uuid[])`,
              [allTemaIds],
            )
          : Promise.resolve({ rows: [] }),
      ]);

      // Objetivo holístico como texto para el prompt
      const obj = objResult.rows[0];
      const objetivo_holistico = obj
        ? `Ser: ${obj.ser}\nSaber: ${obj.saber}\nHacer: ${obj.hacer}\nDecidir: ${obj.decidir}`
        : '';

      // Temas agrupados por área
      const temas: Record<string, { trimestre_num: number; titulo: string; descripcion: string }[]> = {};
      for (const areaId of dto.areas_seleccionadas) {
        const selIds = dto.temas_seleccionados[areaId] ?? [];
        temas[areaId] = temasResult.rows
          .filter((t: any) => t.area_curricular_id === areaId && selIds.includes(t.id))
          .map((t: any) => ({
            trimestre_num: t.trimestre_num,
            titulo: t.titulo,
            descripcion: t.descripcion ?? '',
          }));
      }

      const aiPayload = {
        usuario_id:          dto.usuario_id,
        nombre_docente:      dto.nombre_docente,
        ci_docente:          dto.ci_docente,
        titulo_docente:      dto.titulo_docente ?? '',
        unidad_educativa:    dto.unidad_educativa,
        distrito:            dto.distrito,
        nombre_director:     dto.nombre_director ?? '',
        anio_escolaridad_id: dto.anio_escolaridad_id,
        trimestre_id:        dto.trimestre_id,
        objetivo_holistico,
        materiales:          dto.materiales ?? '',
        contexto_social:     dto.contexto_social ?? '',
        areas:               areasResult.rows.map((a: any) => ({ id: a.id, nombre: a.nombre, codigo: a.codigo })),
        temas,
      };

      // Paso 1: ms-ai-generator genera el contenido PDC con Ollama y persiste
      const genRes = await axios.post(`${this.aiUrl}/generate`, aiPayload, {
        timeout: 600000,
      });
      const { plan_id } = genRes.data;

      // Paso 2: ms-doc-processor genera el .docx y lo sube a S3
      const docRes = await axios.post(
        `${this.docUrl}/doc/${plan_id}/upload`,
        {},
        { timeout: 30000 },
      );
      const { s3_key, s3_url, fallback_url, filename } = docRes.data;

      // Persistir el S3 key (no la URL firmada que expira en 1h)
      const stored_url = s3_key ?? fallback_url ?? `/doc/${plan_id}`;
      await client.query(
        'UPDATE plan_curricular SET filename = $1, download_url = $2 WHERE id = $3',
        [filename, stored_url, plan_id],
      );

      // Devolver la URL fresca para descarga inmediata en el wizard
      const download_url = s3_url ?? `${this.docPublicUrl}${fallback_url ?? `/doc/${plan_id}`}`;
      return { plan_id, download_url, filename };
    } finally {
      client.release();
    }
  }
}
