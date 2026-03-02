import fs from 'fs';
import path from 'path';
import pool from './pool';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Database schema created successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
