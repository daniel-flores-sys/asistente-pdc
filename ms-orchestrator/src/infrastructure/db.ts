import { Pool } from 'pg';

// Pool compartido en todo el proceso. No usar TypeORM para evitar
// complejidad de entidades y migraciones en una demo.
export const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'postgres',
  port:     parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME     ?? 'genplan_db',
  user:     process.env.DB_USER     ?? 'genplan_user',
  password: process.env.DB_PASSWORD ?? 'genplan_pass',
  max: 5,
  idleTimeoutMillis: 30000,
});
