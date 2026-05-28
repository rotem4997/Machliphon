import fs from 'fs';
import path from 'path';
import { query } from './pool';

/**
 * Run migration inline (called from server startup, shares the same pool).
 * Does NOT call pool.end() so the server can keep using the connection.
 */
export async function runMigrations() {
  console.log('🔄 Running migrations...');

  // Find schema.sql - handle both dev (src/) and prod (dist/) paths
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.join(__dirname, '..', 'db', 'schema.sql'),
    path.join(process.cwd(), 'server', 'src', 'db', 'schema.sql'),
    path.join(process.cwd(), 'src', 'db', 'schema.sql'),
  ];

  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    console.error('❌ schema.sql not found. Tried:', candidates);
    throw new Error('schema.sql not found');
  }

  const schema = fs.readFileSync(found, 'utf-8');
  await query(schema);
  console.log('✅ Schema applied');

  // Make absence_id nullable (for direct assignments without an absence report)
  await query(`ALTER TABLE assignments ALTER COLUMN absence_id DROP NOT NULL`).catch(() => {});

  // Add UNIQUE constraint on authorities.name to prevent duplicate authority rows
  // which would break authority-scoped queries for all roles.
  await query(`
    ALTER TABLE authorities ADD CONSTRAINT authorities_name_unique UNIQUE (name)
  `).catch(() => {}); // catch: constraint may already exist

  // Add teaching_license_url column if missing
  await query(`ALTER TABLE substitutes ADD COLUMN IF NOT EXISTS teaching_license_url VARCHAR(500)`).catch(() => {});

  const users = await query('SELECT COUNT(*)::int AS count FROM users');
  const demo = await query(
    `SELECT COUNT(*)::int AS count FROM users WHERE email = 'director@yokneam.muni.il'`,
  );
  const dbEmpty = users.rows[0].count === 0;
  const demoMissing = demo.rows[0].count === 0;

  if (dbEmpty || demoMissing) {
    console.log(
      dbEmpty
        ? '🌱 Empty database — running seed...'
        : '🌱 Demo accounts missing — running seed...',
    );
    try {
      const { seedData } = await import('./seed');
      await seedData();
    } catch (err) {
      console.error('⚠️  Seed failed:', err);
    }
  } else {
    console.log('ℹ️  Demo accounts already present, skipping seed');
  }

  // Always force-reset demo passwords so "Demo1234!" always works.
  try {
    const { resetDemoPasswords } = await import('./seed');
    await resetDemoPasswords();
  } catch (err) {
    console.warn('⚠️  Could not reset demo passwords:', err);
  }

  // Add composite indexes for 70-kindergarten scale performance
  await query(`CREATE INDEX IF NOT EXISTS idx_kindergartens_authority_active ON kindergartens(authority_id, is_active)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_absence_reports_kg_status_date ON absence_reports(kindergarten_id, status, absence_date DESC)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_assignments_kg_date_status ON assignments(kindergarten_id, assignment_date, status)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_manager_kg_reverse ON manager_kindergartens(kindergarten_id)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_substitutes_authority_permit ON substitutes(authority_id, work_permit_expiry)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`).catch(() => {});

  console.log('✅ Migration complete');
}

// Allow running standalone: node migrate.js
if (require.main === module) {
  const pool = require('./pool').default;
  runMigrations()
    .then(() => pool.end())
    .catch((err: Error) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
