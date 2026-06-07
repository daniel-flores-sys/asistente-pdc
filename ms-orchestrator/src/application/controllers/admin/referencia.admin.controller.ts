import {
  Controller, Get, Post, Put, Delete,
  Body, Param, ParseIntPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';
import { pool }              from '../../../infrastructure/db';
import { JwtAuthGuard }      from '../../../infrastructure/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../../infrastructure/guards/roles.guard';

// ── DTOs mínimos ────────────────────────────────────────────────────────────
class NombreDto      { @IsString() @IsNotEmpty() nombre: string; }
class NivelAreaDto   { @IsString() @IsNotEmpty() nombre: string; @IsString() @IsNotEmpty() codigo: string; @IsInt() nivel_id: number; }
class AnioDto        { @IsInt() nivel_id: number; @IsInt() numero: number; @IsString() @IsNotEmpty() literal: string; }
class TemaDto        { @IsInt() area_curricular_id: number; @IsInt() anio_escolaridad_id: number; @IsInt() trimestre_num: number; @IsInt() semana_num: number; @IsString() @IsNotEmpty() titulo: string; @IsString() @IsOptional() descripcion?: string; }
class ObjetivoDto    { @IsInt() anio_escolaridad_id: number; @IsInt() trimestre_num: number; @IsString() @IsNotEmpty() ser: string; @IsString() @IsNotEmpty() saber: string; @IsString() @IsNotEmpty() hacer: string; @IsString() @IsNotEmpty() decidir: string; }

@Controller('api/admin/referencia')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ReferenciaAdminController {

  // ── Niveles educativos ─────────────────────────────────────────────────────

  @Get('niveles')
  async getNiveles() {
    const res = await pool.query('SELECT * FROM nivel_educativo ORDER BY id');
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

  // ── Años de escolaridad ───────────────────────────────────────────────────

  @Get('anios')
  async getAnios() {
    const res = await pool.query(`
      SELECT ae.*, ne.nombre AS nivel_nombre
      FROM anio_escolaridad ae
      JOIN nivel_educativo ne ON ne.id = ae.nivel_id
      ORDER BY ae.nivel_id, ae.numero
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

  // ── Áreas curriculares ────────────────────────────────────────────────────

  @Get('areas')
  async getAreas() {
    const res = await pool.query('SELECT * FROM area_curricular ORDER BY nivel_id, id');
    return res.rows;
  }

  @Post('areas')
  async createArea(@Body() dto: NivelAreaDto) {
    const res = await pool.query(
      'INSERT INTO area_curricular (nivel_id, nombre, codigo) VALUES ($1, $2, $3) RETURNING *',
      [dto.nivel_id, dto.nombre, dto.codigo],
    );
    return res.rows[0];
  }

  // ── Temas por mes ─────────────────────────────────────────────────────────

  @Get('temas')
  async getTemas() {
    const res = await pool.query('SELECT * FROM tema_mes ORDER BY area_curricular_id, trimestre_num, semana_num');
    return res.rows;
  }

  @Post('temas')
  async createTema(@Body() dto: TemaDto) {
    const res = await pool.query(
      `INSERT INTO tema_mes (area_curricular_id, anio_escolaridad_id, trimestre_num, semana_num, titulo, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [dto.area_curricular_id, dto.anio_escolaridad_id, dto.trimestre_num, dto.semana_num, dto.titulo, dto.descripcion ?? null],
    );
    return res.rows[0];
  }

  @Delete('temas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTema(@Param('id', ParseIntPipe) id: number) {
    await pool.query('DELETE FROM tema_mes WHERE id = $1', [id]);
  }

  // ── Objetivos holísticos ──────────────────────────────────────────────────

  @Get('objetivos')
  async getObjetivos() {
    const res = await pool.query('SELECT * FROM objetivo_holistico ORDER BY anio_escolaridad_id, trimestre_num');
    return res.rows;
  }

  @Post('objetivos')
  async createObjetivo(@Body() dto: ObjetivoDto) {
    const res = await pool.query(
      `INSERT INTO objetivo_holistico (anio_escolaridad_id, trimestre_num, ser, saber, hacer, decidir)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [dto.anio_escolaridad_id, dto.trimestre_num, dto.ser, dto.saber, dto.hacer, dto.decidir],
    );
    return res.rows[0];
  }

  @Put('objetivos/:id')
  async updateObjetivo(@Param('id', ParseIntPipe) id: number, @Body() dto: ObjetivoDto) {
    const res = await pool.query(
      `UPDATE objetivo_holistico SET ser=$1, saber=$2, hacer=$3, decidir=$4
       WHERE id=$5 RETURNING *`,
      [dto.ser, dto.saber, dto.hacer, dto.decidir, id],
    );
    return res.rows[0];
  }
}
