import {
  Controller, Get, Post, Delete,
  Param, ParseIntPipe, Res,
  UseGuards, UseInterceptors, UploadedFile,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor }   from '@nestjs/platform-express';
import { ConfigService }     from '@nestjs/config';
import { Response }          from 'express';
import axios                 from 'axios';
import FormData              from 'form-data';
import { JwtAuthGuard }      from '../../../infrastructure/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../../infrastructure/guards/roles.guard';

@Controller('api/admin/documentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DocumentosAdminController {
  private readonly ingestionUrl: string;

  constructor(private readonly config: ConfigService) {
    this.ingestionUrl = this.config.get<string>('INGESTION_URL') ?? 'http://ms-ingestion:8003';
  }

  @Get()
  async list(@Res() res: Response) {
    try {
      const upstream = await axios.get(`${this.ingestionUrl}/docs`, {
        timeout: 10000,
        validateStatus: () => true,
      });
      return res.status(upstream.status).json(upstream.data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException({ error: 'ms-ingestion no disponible', detalle: msg }, HttpStatus.BAD_GATEWAY);
    }
  }

  // multer almacena el archivo en memoria (buffer) para reenviarlo como multipart a ms-ingestion
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: undefined }))
  async upload(@UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string } | undefined, @Res() res: Response) {
    if (!file) {
      throw new HttpException({ error: 'Se requiere un archivo (campo "file")' }, HttpStatus.BAD_REQUEST);
    }

    try {
      const form = new FormData();
      form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });

      const upstream = await axios.post(`${this.ingestionUrl}/ingest`, form, {
        headers: form.getHeaders(),
        timeout: 120000,
        validateStatus: () => true,
      });
      return res.status(upstream.status).json(upstream.data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException({ error: 'ms-ingestion no disponible', detalle: msg }, HttpStatus.BAD_GATEWAY);
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const upstream = await axios.delete(`${this.ingestionUrl}/docs/${id}`, {
        timeout: 10000,
        validateStatus: () => true,
      });
      return res.status(upstream.status).json(upstream.data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException({ error: 'ms-ingestion no disponible', detalle: msg }, HttpStatus.BAD_GATEWAY);
    }
  }
}
