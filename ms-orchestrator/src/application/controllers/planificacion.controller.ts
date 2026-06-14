import {
  Controller, Post, Get, Body, Request,
  HttpException, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  IsString, IsNotEmpty, IsUUID, IsArray,
  IsObject, IsOptional,
} from 'class-validator';
import { AiGeneratorService }   from '../../infrastructure/services/ai-generator.service';
import { ReferenceDataService } from '../../infrastructure/services/reference-data.service';
import { UsuarioService }       from '../../infrastructure/services/usuario.service';
import { JwtAuthGuard }         from '../../infrastructure/guards/jwt-auth.guard';
import { RolesGuard, Roles }    from '../../infrastructure/guards/roles.guard';

export class GenerarPDCDto {
  @IsString() @IsNotEmpty() nombre_docente: string;
  @IsString() @IsNotEmpty() ci_docente: string;
  @IsString() @IsOptional() titulo_docente?: string;
  @IsString() @IsNotEmpty() unidad_educativa: string;
  @IsString() @IsNotEmpty() distrito: string;
  @IsString() @IsOptional() nombre_director?: string;

  @IsUUID() anio_escolaridad_id: string;
  @IsUUID() trimestre_id: string;

  @IsArray() @IsUUID('4', { each: true }) areas_seleccionadas: string[];
  @IsObject() temas_seleccionados: Record<string, string[]>;

  @IsString() @IsOptional() materiales?: string;
  @IsString() @IsOptional() contexto_social?: string;
}

@Controller('api')
export class PlanificacionController {
  constructor(
    private readonly aiService:      AiGeneratorService,
    private readonly refService:     ReferenceDataService,
    private readonly usuarioService: UsuarioService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'ms-orchestrator' };
  }

  @Get('reference-data')
  async getReferenceData() {
    try {
      return await this.refService.getReferenceData();
    } catch (error) {
      throw new HttpException(
        { error: 'Error al obtener datos de referencia', detalle: error.message },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('docente')
  async generate(@Body() dto: GenerarPDCDto, @Request() req) {
    // Verificar créditos antes de llamar a la IA; 402 = Payment Required
    const user = await this.usuarioService.findById(req.user.sub);
    if (!user || user.creditos <= 0) {
      throw new HttpException(
        { error: 'Sin créditos disponibles. Contacta al administrador.' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    try {
      const result = await this.aiService.generatePDC({ ...dto, usuario_id: req.user.sub });

      // Descuenta crédito solo tras generación exitosa
      const creditos_restantes = await this.usuarioService.decrementCreditos(req.user.sub);
      return { ...result, creditos_restantes };
    } catch (error) {
      throw new HttpException(
        { error: 'Error al generar el PDC', detalle: error.message },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
