import {
  Controller, Get, Post, Put, Body,
  Param, UseGuards, HttpCode, HttpStatus,
  ConflictException,
} from '@nestjs/common';
import {
  IsString, IsNotEmpty, IsEmail, IsInt,
  IsBoolean, IsOptional, Min, MinLength,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { UsuarioService } from '../../../infrastructure/services/usuario.service';
import { JwtAuthGuard }   from '../../../infrastructure/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../../infrastructure/guards/roles.guard';

class CreateUsuarioDto {
  @IsString() @IsNotEmpty()  nombre: string;
  @IsEmail()                 email: string;
  @IsString() @MinLength(6)  password: string;
  @IsString() @IsNotEmpty()  ci: string;
  @IsString() @IsOptional()  titulo?: string;
  @IsInt() @Min(0) @IsOptional() creditos?: number;
}

class UpdateCreditosDto {
  @IsInt() @Min(0) creditos: number;
}

class UpdateActivoDto {
  @IsBoolean() activo: boolean;
}

@Controller('api/admin/usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsuariosAdminController {
  constructor(private readonly usuarioService: UsuarioService) {}

  @Get()
  list() {
    return this.usuarioService.listAll();
  }

  @Post()
  async create(@Body() dto: CreateUsuarioDto) {
    const hash = await bcrypt.hash(dto.password, 12);
    try {
      const user = await this.usuarioService.create(dto.nombre, dto.email, hash, dto.ci, dto.titulo);
      if (dto.creditos && dto.creditos > 0) {
        await this.usuarioService.updateCreditos(user.id, dto.creditos);
        user.creditos = dto.creditos;
      }
      return user;
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('Ya existe un usuario con ese email o CI');
      }
      throw err;
    }
  }

  @Put(':id/creditos')
  @HttpCode(HttpStatus.OK)
  async setCreditos(
    @Param('id') id: string,
    @Body() dto: UpdateCreditosDto,
  ) {
    await this.usuarioService.updateCreditos(id, dto.creditos);
    return { id, creditos: dto.creditos };
  }

  @Put(':id/activo')
  @HttpCode(HttpStatus.OK)
  async setActivo(
    @Param('id') id: string,
    @Body() dto: UpdateActivoDto,
  ) {
    await this.usuarioService.setActivo(id, dto.activo);
    return { id, activo: dto.activo };
  }
}
