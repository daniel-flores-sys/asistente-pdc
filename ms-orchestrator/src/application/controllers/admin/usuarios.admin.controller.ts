import {
  Controller, Get, Post, Put, Body,
  Param, ParseIntPipe, UseGuards, HttpCode, HttpStatus,
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
    // create() da creditos=0; si el admin envió un valor lo actualizamos luego
    const user = await this.usuarioService.create(dto.nombre, dto.email, hash, dto.ci);
    if (dto.creditos && dto.creditos > 0) {
      await this.usuarioService.updateCreditos(user.id, dto.creditos);
    }
    return user;
  }

  @Put(':id/creditos')
  @HttpCode(HttpStatus.OK)
  async setCreditos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCreditosDto,
  ) {
    await this.usuarioService.updateCreditos(id, dto.creditos);
    return { id, creditos: dto.creditos };
  }

  @Put(':id/activo')
  @HttpCode(HttpStatus.OK)
  async setActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActivoDto,
  ) {
    await this.usuarioService.setActivo(id, dto.activo);
    return { id, activo: dto.activo };
  }
}
