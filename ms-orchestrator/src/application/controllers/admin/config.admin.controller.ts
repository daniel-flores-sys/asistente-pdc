import {
  Controller, Get, Put, Body,
  Param, UseGuards,
} from '@nestjs/common';
import { IsNotEmpty } from 'class-validator';
import { pool }              from '../../../infrastructure/db';
import { JwtAuthGuard }      from '../../../infrastructure/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../../infrastructure/guards/roles.guard';

// El valor es JSON libre — se valida que no esté vacío pero su estructura la define el cliente
class UpdateConfigDto {
  @IsNotEmpty() valor: Record<string, unknown> | string | number | boolean;
}

// Claves válidas para evitar escritura arbitraria en system_config
const CLAVES_VALIDAS = new Set(['llm_params', 'rag_params', 'prompts']);

@Controller('api/admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ConfigAdminController {

  @Get()
  async list() {
    const res = await pool.query('SELECT clave, valor, actualizado_en FROM system_config ORDER BY clave');
    return res.rows;
  }

  @Put(':clave')
  async update(@Param('clave') clave: string, @Body() dto: UpdateConfigDto) {
    if (!CLAVES_VALIDAS.has(clave)) {
      // Retornamos 400 manualmente para no importar BadRequestException aquí
      throw Object.assign(new Error(`Clave no permitida: ${clave}`), { status: 400 });
    }
    const res = await pool.query(
      `INSERT INTO system_config (clave, valor, actualizado_en)
       VALUES ($1, $2, NOW())
       ON CONFLICT (clave) DO UPDATE
         SET valor = EXCLUDED.valor,
             actualizado_en = NOW()
       RETURNING *`,
      [clave, JSON.stringify(dto.valor)],
    );
    return res.rows[0];
  }
}
