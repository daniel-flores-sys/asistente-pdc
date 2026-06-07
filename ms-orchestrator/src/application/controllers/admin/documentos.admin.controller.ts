import {
  Controller, All, Req, Res, Param,
  UseGuards, HttpException, HttpStatus,
} from '@nestjs/common';
import { ConfigService }     from '@nestjs/config';
import { Request, Response } from 'express';
import axios                 from 'axios';
import { JwtAuthGuard }      from '../../../infrastructure/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../../infrastructure/guards/roles.guard';

// Proxy transparente hacia ms-ingestion para gestión de documentos RAG.
// Así el admin interactúa con un solo punto de entrada (ms-orchestrator).
@Controller('api/admin/documentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DocumentosAdminController {
  private readonly ingestionUrl: string;

  constructor(private readonly config: ConfigService) {
    this.ingestionUrl = this.config.get<string>('INGESTION_URL') ?? 'http://ms-ingestion:8003';
  }

  @All()
  @All(':path(*)')
  async proxy(@Req() req: Request, @Res() res: Response, @Param('path') path = '') {
    try {
      const target = `${this.ingestionUrl}/documentos/${path}`;
      const upstream = await axios.request({
        method:  req.method as any,
        url:     target,
        params:  req.query,
        data:    req.body,
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true,   // reenviar el status code del upstream
      });
      return res.status(upstream.status).json(upstream.data);
    } catch (error) {
      throw new HttpException(
        { error: 'ms-ingestion no disponible', detalle: error.message },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
