import { Pool } from 'pg';

// Los checks al conectar garantizan fail-fast en runtime sin romper el import en tests
export const pool = new Pool({
  host:     process.env.DB_HOST ?? 'postgres',
  port:     parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME ?? 'genplan_db',
  user:     process.env.DB_USER ?? '',
  password: process.env.DB_PASSWORD ?? '',
  max: 5,
  idleTimeoutMillis: 30000,
});
