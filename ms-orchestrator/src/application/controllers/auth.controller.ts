import {
  Controller, Post, Get, Body,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { IsEmail, IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { AuthService }    from '../../infrastructure/services/auth.service';
import { JwtAuthGuard }  from '../../infrastructure/guards/jwt-auth.guard';

class RegisterDto {
  @IsString() @IsNotEmpty()  nombre: string;
  @IsEmail()                 email: string;
  @IsString() @MinLength(6)  password: string;
  @IsString() @IsNotEmpty()  ci: string;
  @IsString() @IsOptional()  titulo?: string;
}

class LoginDto {
  @IsEmail()                email: string;
  @IsString() @IsNotEmpty() password: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.nombre, dto.email, dto.password, dto.ci, dto.titulo);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req) {
    return this.authService.getMe(req.user.sub, req.user.role);
  }
}
