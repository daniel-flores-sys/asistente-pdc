import {
  Controller, All, Req, Res,
  UseGuards, HttpException, HttpStatus,
} from '@nestjs/common';
import { ConfigService }     from '@nestjs/config';
import { Request, Response } from 'express';
import axios                 from 'axios';
import { JwtAuthGuard }      from '../../../infrastructure/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../../infrastructure/guards/roles.guard';

// Proxy hacia ms-monitor: expone scaling manual y estado de réplicas al panel admin
@Controller('api/admin/monitor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MonitorAdminController {
  private readonly monitorUrl: string;

  constructor(private readonly config: ConfigService) {
    this.monitorUrl = this.config.get<string>('MONITOR_URL') ?? 'http://ms-monitor:8002';
  }

  // @All(':path(*)') no captura paths con '/' en Express — se usa req.path en su lugar
  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    try {
      // Extrae el sub-path después de /api/admin/monitor
      const subPath = req.path.replace(/^\/api\/admin\/monitor\/?/, '');
      const target = subPath ? `${this.monitorUrl}/monitor/${subPath}` : `${this.monitorUrl}/monitor`;
      const upstream = await axios.request({
        method:  req.method as any,
        url:     target,
        params:  req.query,
        data:    req.body,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
      });
      return res.status(upstream.status).json(upstream.data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        { error: 'ms-monitor no disponible', detalle: msg },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
