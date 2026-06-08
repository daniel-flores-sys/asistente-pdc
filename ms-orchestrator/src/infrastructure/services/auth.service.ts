import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { pool } from '../db';
import { UsuarioService } from './usuario.service';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly usuarioService: UsuarioService,
  ) {}

  async register(nombre: string, email: string, password: string, ci: string, titulo?: string) {
    const existing = await this.usuarioService.findByEmail(email);
    if (existing) throw new ConflictException('El email ya está registrado');

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.usuarioService.create(nombre, email, hash, ci, titulo);
    return { id: user.id, nombre: user.nombre, email: user.email, creditos: user.creditos };
  }

  async login(email: string, password: string) {
    // Intentar como docente primero
    const docente = await this.usuarioService.findByEmail(email);
    if (docente && await bcrypt.compare(password, docente.password_hash)) {
      const token = this.sign(docente.id, email, 'docente');
      return {
        access_token: token,
        user: { id: docente.id, nombre: docente.nombre, email, creditos: docente.creditos, role: 'docente' },
      };
    }

    // Intentar como admin
    const adminRes = await pool.query(
      'SELECT * FROM admins WHERE email = $1 AND activo = true',
      [email],
    );
    const admin = adminRes.rows[0];
    if (admin && await bcrypt.compare(password, admin.password_hash)) {
      const token = this.sign(admin.id, email, 'admin');
      return {
        access_token: token,
        user: { id: admin.id, nombre: admin.nombre, email, role: 'admin' },
      };
    }

    throw new UnauthorizedException('Credenciales inválidas');
  }

  async getMe(id: number, role: string) {
    if (role === 'admin') {
      const res = await pool.query(
        'SELECT id, nombre, email, activo, creado_en FROM admins WHERE id = $1',
        [id],
      );
      return { ...res.rows[0], role: 'admin' };
    }
    const user = await this.usuarioService.findById(id);
    return { ...user, role: 'docente' };
  }

  // Se llama al iniciar la app; inserta el admin inicial si no existe ninguno en la tabla
  async ensureAdminExists() {
    const adminEmail    = this.config.get<string>('ADMIN_EMAIL');
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD');
    if (!adminEmail || !adminPassword) return;

    const existing = await pool.query('SELECT id FROM admins WHERE email = $1', [adminEmail]);
    if (existing.rows.length > 0) return;

    const hash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    await pool.query(
      `INSERT INTO admins (nombre, email, password_hash, activo)
       VALUES ('Administrador', $1, $2, true)`,
      [adminEmail, hash],
    );
    console.log(`[bootstrap] Admin inicial creado: ${adminEmail}`);
  }

  private sign(sub: number, email: string, role: string): string {
    return this.jwtService.sign({ sub, email, role });
  }
}
