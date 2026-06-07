import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Controllers
import { PlanificacionController }    from './application/controllers/planificacion.controller';
import { AuthController }             from './application/controllers/auth.controller';
import { HistorialController }        from './application/controllers/historial.controller';
import { UsuariosAdminController }    from './application/controllers/admin/usuarios.admin.controller';
import { ReferenciaAdminController }  from './application/controllers/admin/referencia.admin.controller';
import { ConfigAdminController }      from './application/controllers/admin/config.admin.controller';
import { DocumentosAdminController }  from './application/controllers/admin/documentos.admin.controller';
import { MonitorAdminController }     from './application/controllers/admin/monitor.admin.controller';

// Services
import { AiGeneratorService }   from './infrastructure/services/ai-generator.service';
import { ReferenceDataService } from './infrastructure/services/reference-data.service';
import { UsuarioService }       from './infrastructure/services/usuario.service';
import { AuthService }          from './infrastructure/services/auth.service';

// Guards
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { RolesGuard }   from './infrastructure/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // JwtModule global: todos los guards acceden a JwtService sin importar el módulo manualmente
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:       config.get<string>('JWT_SECRET'),
        signOptions:  { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '8h' },
      }),
      global: true,
    }),
  ],
  controllers: [
    PlanificacionController,
    AuthController,
    HistorialController,
    UsuariosAdminController,
    ReferenciaAdminController,
    ConfigAdminController,
    DocumentosAdminController,
    MonitorAdminController,
  ],
  providers: [
    AiGeneratorService,
    ReferenceDataService,
    UsuarioService,
    AuthService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly authService: AuthService) {}

  // Crea el admin inicial desde env vars si la tabla admins está vacía
  async onModuleInit() {
    await this.authService.ensureAdminExists();
  }
}
