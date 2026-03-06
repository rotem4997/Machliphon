import pg, { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

// PostgreSQL returns NUMERIC/DECIMAL columns as strings by default.
// This causes .toFixed() crashes on the frontend. Parse them globally.
pg.types.setTypeParser(1700, (val: string) => parseFloat(val)); // OID 1700 = NUMERIC/DECIMAL

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL environment variable is not set!');
  console.error('   On Railway: Add a PostgreSQL plugin and ensure DATABASE_URL is linked.');
  console.error('   Locally: Create a .env file with DATABASE_URL=postgresql://...');
}

const config: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Do NOT exit — let the server keep running so health endpoint works
});

export const query = async (text: string, params?: unknown[]) => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Add a PostgreSQL database to your Railway project.');
  }
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('query', { text: text.substring(0, 50), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const getClient = () => pool.connect();

export default pool;
