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
    // URL accesible desde el navegador del docente (puede diferir del host Docker interno)
    this.docPublicUrl = this.configService.get<string>('DOC_PROCESSOR_PUBLIC_URL') ?? 'http://localhost:8001';
  }

  async generatePDC(payload: Record<string, unknown>) {
    // Paso 1: ms-ai-generator construye el contenido PDC y lo persiste en plan_curricular
    const genRes = await axios.post(`${this.aiUrl}/generate`, payload, {
      timeout: 90000,  // 90 s: Gemma en CPU puede tardar; mock es instantáneo
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
}
