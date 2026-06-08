import {
  Controller, Get, Post, Delete,
  Param, ParseIntPipe, Req, Res,
  UseGuards, UseInterceptors, UploadedFile,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor }   from '@nestjs/platform-express';
import { ConfigService }     from '@nestjs/config';
import { Request, Response } from 'express';
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
      const upstream = await axios.get(`${this.ingestionUrl}/documentos`, {
        timeout: 10000,
        validateStatus: () => true,
      });
      return res.status(upstream.status).json(upstream.data);
    } catch (error) {
      throw new HttpException({ error: 'ms-ingestion no disponible', detalle: error.message }, HttpStatus.BAD_GATEWAY);
    }
  }

  // Recibe multipart/form-data con el archivo, lo reenvía a ms-ingestion como multipart.
  // multer guarda el archivo en memoria (buffer) para poder reenviarlo sin escribir en disco.
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: undefined }))
  async upload(@UploadedFile() file: Express.Multer.File, @Res() res: Response) {
    if (!file) {
      throw new HttpException({ error: 'Se requiere un archivo (campo "file")' }, HttpStatus.BAD_REQUEST);
    }

    try {
      const form = new FormData();
      form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });

      const upstream = await axios.post(`${this.ingestionUrl}/ingest`, form, {
        headers: form.getHeaders(),
        timeout: 120000,    // indexación puede tardar en documentos grandes
        validateStatus: () => true,
      });
      return res.status(upstream.status).json(upstream.data);
    } catch (error) {
      throw new HttpException({ error: 'ms-ingestion no disponible', detalle: error.message }, HttpStatus.BAD_GATEWAY);
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const upstream = await axios.delete(`${this.ingestionUrl}/documentos/${id}`, {
        timeout: 10000,
        validateStatus: () => true,
      });
      return res.status(upstream.status).json(upstream.data);
    } catch (error) {
      throw new HttpException({ error: 'ms-ingestion no disponible', detalle: error.message }, HttpStatus.BAD_GATEWAY);
    }
  }
}
