import {
  Controller, All, Req, Res, Param,
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

  @All()
  @All(':path(*)')
  async proxy(@Req() req: Request, @Res() res: Response, @Param('path') path = '') {
    try {
      const target = `${this.monitorUrl}/${path}`;
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
    } catch (error) {
      throw new HttpException(
        { error: 'ms-monitor no disponible', detalle: error.message },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
