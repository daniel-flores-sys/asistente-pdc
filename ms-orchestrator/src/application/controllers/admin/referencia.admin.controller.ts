import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  IsString, IsNotEmpty, IsInt, IsOptional, IsIn, Min, Max,
} from 'class-validator';
import { pool }              from '../../../infrastructure/db';
import { JwtAuthGuard }      from '../../../infrastructure/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../../infrastructure/guards/roles.guard';

// ── DTOs ────────────────────────────────────────────────────────────────────

class NombreDto {
  @IsString() @IsNotEmpty() nombre: string;
}

class NivelAreaDto {
  @IsNotEmpty() nivel_id: string | number;
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsNotEmpty() codigo: string;
  @IsString() @IsOptional() carga_horaria?: string;
}

class AnioDto {
  @IsNotEmpty() nivel_id: string | number;
  @IsInt() @Min(1) @Max(12) numero: number;
  @IsString() @IsNotEmpty() literal: string;
}

class TemaTriDto {
  @IsNotEmpty() area_curricular_id: string | number;
  @IsNotEmpty() anio_escolaridad_id: string | number;
  @IsInt() @IsIn([1, 2, 3]) trimestre_num: number;
  @IsString() @IsNotEmpty() titulo: string;
  @IsString() @IsOptional() descripcion?: string;
}

class ObjetivoDto {
  @IsNotEmpty() anio_escolaridad_id: string | number;
  @IsInt() @IsIn([1, 2, 3]) trimestre_num: number;
  @IsString() @IsNotEmpty() ser: string;
  @IsString() @IsNotEmpty() saber: string;
  @IsString() @IsNotEmpty() hacer: string;
  @IsString() @IsNotEmpty() decidir: string;
}

@Controller('api/admin/referencia')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ReferenciaAdminController {

  // ── Niveles educativos ─────────────────────────────────────────────────────

  @Get('niveles')
  async getNiveles() {
    const res = await pool.query('SELECT * FROM nivel_educativo ORDER BY nombre');
    return res.rows;
  }

  @Post('niveles')
  async createNivel(@Body() dto: NombreDto) {
    const res = await pool.query(
      'INSERT INTO nivel_educativo (nombre) VALUES ($1) RETURNING *',
      [dto.nombre],
    );
    return res.rows[0];
  }

  @Put('niveles/:id')
  async updateNivel(@Param('id') id: string, @Body() dto: NombreDto) {
    const res = await pool.query(
      'UPDATE nivel_educativo SET nombre=$1 WHERE id=$2 RETURNING *',
      [dto.nombre, id],
    );
    return res.rows[0];
  }

  @Delete('niveles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNivel(@Param('id') id: string) {
    await pool.query('DELETE FROM nivel_educativo WHERE id=$1', [id]);
  }

  // ── Años de escolaridad ────────────────────────────────────────────────────

  @Get('anios')
  async getAnios() {
    const res = await pool.query(`
      SELECT ae.*, ne.nombre AS nivel_nombre
      FROM anio_escolaridad ae
      JOIN nivel_educativo ne ON ne.id = ae.nivel_id
      ORDER BY ne.nombre, ae.numero
    `);
    return res.rows;
  }

  @Post('anios')
  async createAnio(@Body() dto: AnioDto) {
    const res = await pool.query(
      'INSERT INTO anio_escolaridad (nivel_id, numero, literal) VALUES ($1, $2, $3) RETURNING *',
      [dto.nivel_id, dto.numero, dto.literal],
    );
    return res.rows[0];
  }

  @Put('anios/:id')
  async updateAnio(@Param('id') id: string, @Body() dto: AnioDto) {
    const res = await pool.query(
      'UPDATE anio_escolaridad SET nivel_id=$1, numero=$2, literal=$3 WHERE id=$4 RETURNING *',
      [dto.nivel_id, dto.numero, dto.literal, id],
    );
    return res.rows[0];
  }

  @Delete('anios/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAnio(@Param('id') id: string) {
    await pool.query('DELETE FROM anio_escolaridad WHERE id=$1', [id]);
  }

  // ── Áreas curriculares ─────────────────────────────────────────────────────

  @Get('areas')
  async getAreas() {
    const res = await pool.query(`
      SELECT ac.*, ne.nombre AS nivel_nombre
      FROM area_curricular ac
      JOIN nivel_educativo ne ON ne.id = ac.nivel_id
      ORDER BY ne.nombre, ac.nombre
    `);
    return res.rows;
  }

  @Post('areas')
  async createArea(@Body() dto: NivelAreaDto) {
    const res = await pool.query(
      'INSERT INTO area_curricular (nivel_id, nombre, codigo, carga_horaria) VALUES ($1, $2, $3, $4) RETURNING *',
      [dto.nivel_id, dto.nombre, dto.codigo, dto.carga_horaria ?? null],
    );
    return res.rows[0];
  }

  @Put('areas/:id')
  async updateArea(@Param('id') id: string, @Body() dto: NivelAreaDto) {
    const res = await pool.query(
      'UPDATE area_curricular SET nivel_id=$1, nombre=$2, codigo=$3, carga_horaria=$4 WHERE id=$5 RETURNING *',
      [dto.nivel_id, dto.nombre, dto.codigo, dto.carga_horaria ?? null, id],
    );
    return res.rows[0];
  }

  @Delete('areas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteArea(@Param('id') id: string) {
    await pool.query('DELETE FROM area_curricular WHERE id=$1', [id]);
  }

  // ── Temas trimestrales ─────────────────────────────────────────────────────

  @Get('temas')
  async getTemas() {
    try {
      const res = await pool.query(`
        SELECT tt.*,
               ac.nombre  AS area_nombre,
               ac.codigo  AS area_codigo,
               ae.literal AS anio_literal,
               ne.nombre  AS nivel_nombre
        FROM tema_trimestral tt
        JOIN area_curricular  ac ON ac.id = tt.area_curricular_id
        JOIN anio_escolaridad ae ON ae.id = tt.anio_escolaridad_id
        JOIN nivel_educativo  ne ON ne.id = ae.nivel_id
        ORDER BY ne.nombre, ae.numero, ac.nombre, tt.trimestre_num
      `);
      return res.rows;
    } catch (e: any) {
      // 42P01 = tabla no existe (BD con schema antiguo)
      if (e.code === '42P01') return [];
      throw e;
    }
  }

  @Post('temas')
  async createTema(@Body() dto: TemaTriDto) {
    const res = await pool.query(
      `INSERT INTO tema_trimestral
         (area_curricular_id, anio_escolaridad_id, trimestre_num, titulo, descripcion)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [dto.area_curricular_id, dto.anio_escolaridad_id, dto.trimestre_num, dto.titulo, dto.descripcion ?? null],
    );
    return res.rows[0];
  }

  @Put('temas/:id')
  async updateTema(@Param('id') id: string, @Body() dto: TemaTriDto) {
    const res = await pool.query(
      `UPDATE tema_trimestral
       SET area_curricular_id=$1, anio_escolaridad_id=$2, trimestre_num=$3,
           titulo=$4, descripcion=$5
       WHERE id=$6 RETURNING *`,
      [dto.area_curricular_id, dto.anio_escolaridad_id, dto.trimestre_num, dto.titulo, dto.descripcion ?? null, id],
    );
    return res.rows[0];
  }

  @Delete('temas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTema(@Param('id') id: string) {
    await pool.query('DELETE FROM tema_trimestral WHERE id=$1', [id]);
  }

  // ── Objetivos holísticos ───────────────────────────────────────────────────

  @Get('objetivos')
  async getObjetivos() {
    try {
      const res = await pool.query(`
        SELECT oh.*,
               ae.literal AS anio_literal,
               ne.nombre  AS nivel_nombre
        FROM objetivo_holistico oh
        JOIN anio_escolaridad ae ON ae.id = oh.anio_escolaridad_id
        JOIN nivel_educativo  ne ON ne.id = ae.nivel_id
        ORDER BY ne.nombre, ae.numero, oh.trimestre_num
      `);
      return res.rows;
    } catch (e: any) {
      // 42P01 = tabla no existe; 42703 = columna no existe (schema antiguo)
      if (['42P01', '42703'].includes(e.code)) return [];
      throw e;
    }
  }

  @Post('objetivos')
  async createObjetivo(@Body() dto: ObjetivoDto) {
    const res = await pool.query(
      `INSERT INTO objetivo_holistico
         (anio_escolaridad_id, trimestre_num, ser, saber, hacer, decidir)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [dto.anio_escolaridad_id, dto.trimestre_num, dto.ser, dto.saber, dto.hacer, dto.decidir],
    );
    return res.rows[0];
  }

  @Put('objetivos/:id')
  async updateObjetivo(@Param('id') id: string, @Body() dto: ObjetivoDto) {
    const res = await pool.query(
      `UPDATE objetivo_holistico
       SET anio_escolaridad_id=$1, trimestre_num=$2,
           ser=$3, saber=$4, hacer=$5, decidir=$6
       WHERE id=$7 RETURNING *`,
      [dto.anio_escolaridad_id, dto.trimestre_num, dto.ser, dto.saber, dto.hacer, dto.decidir, id],
    );
    return res.rows[0];
  }

  @Delete('objetivos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteObjetivo(@Param('id') id: string) {
    await pool.query('DELETE FROM objetivo_holistico WHERE id=$1', [id]);
  }
}
