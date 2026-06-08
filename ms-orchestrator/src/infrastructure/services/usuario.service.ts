import { Injectable } from '@nestjs/common';
import { pool } from '../db';

@Injectable()
export class UsuarioService {

  async findByEmail(email: string) {
    const res = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
      [email],
    );
    return res.rows[0] ?? null;
  }

  async findById(id: number) {
    const res = await pool.query(
      'SELECT id, nombre, email, ci, titulo, creditos, activo, creado_en FROM usuarios WHERE id = $1',
      [id],
    );
    return res.rows[0] ?? null;
  }

  async create(nombre: string, email: string, passwordHash: string, ci: string, titulo?: string) {
    const res = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, ci, titulo, creditos, activo)
       VALUES ($1, $2, $3, $4, $5, 0, true)
       RETURNING id, nombre, email, creditos, creado_en`,
      [nombre, email, passwordHash, ci, titulo ?? null],
    );
    return res.rows[0];
  }

  async listAll() {
    const res = await pool.query(
      'SELECT id, nombre, email, ci, titulo, creditos, activo, creado_en FROM usuarios ORDER BY creado_en DESC',
    );
    return res.rows;
  }

  async updateCreditos(id: number, creditos: number) {
    await pool.query('UPDATE usuarios SET creditos = $1 WHERE id = $2', [creditos, id]);
  }

  async setActivo(id: number, activo: boolean) {
    await pool.query('UPDATE usuarios SET activo = $1 WHERE id = $2', [activo, id]);
  }

  // Descuenta 1 crédito de forma atómica; retorna los créditos restantes o null si ya era 0
  async decrementCreditos(id: number): Promise<number | null> {
    const res = await pool.query(
      'UPDATE usuarios SET creditos = creditos - 1 WHERE id = $1 AND creditos > 0 RETURNING creditos',
      [id],
    );
    return res.rows[0]?.creditos ?? null;
  }
}
