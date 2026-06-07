import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AiGeneratorService {
  private readonly aiUrl: string;
  private readonly docUrl: string;

  private readonly docPublicUrl: string;

  constructor(private configService: ConfigService) {
    this.aiUrl        = this.configService.get<string>('AI_GENERATOR_URL')       ?? 'http://ms-ai-generator:8000';
    this.docUrl       = this.configService.get<string>('DOC_PROCESSOR_URL')      ?? 'http://ms-doc-processor:8001';
    // URL accesible desde el navegador del usuario (puede diferir del host Docker interno)
    this.docPublicUrl = this.configService.get<string>('DOC_PROCESSOR_PUBLIC_URL') ?? 'http://localhost:8001';
  }

  async generatePDC(payload: Record<string, unknown>) {
    // Paso 1: ms-ai-generator hace upserts en BD y guarda el plan
    const genRes = await axios.post(`${this.aiUrl}/generate`, payload, {
      timeout: 60000,  // Gemma en CPU puede tardar; mock es instantáneo
    });
    const { plan_id, asignacion_maestro_id } = genRes.data;

    // Paso 2: ms-doc-processor genera el Word y lo sube a S3
    const docRes = await axios.post(
      `${this.docUrl}/doc/${plan_id}/upload`,
      {},
      { timeout: 30000 },
    );
    const { s3_url, fallback_url, filename } = docRes.data;

    // Si hay S3 se usa la URL pre-firmada; si no, se construye la URL pública
    // del endpoint de descarga directa (accesible desde el navegador del docente)
    const download_url = s3_url ?? `${this.docPublicUrl}${fallback_url}`;

    return { plan_id, asignacion_maestro_id, download_url, filename };
  }
}
