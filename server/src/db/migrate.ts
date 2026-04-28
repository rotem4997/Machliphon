import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
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

  // Add teaching_license_url column if missing
  await query(`ALTER TABLE substitutes ADD COLUMN IF NOT EXISTS teaching_license_url VARCHAR(500)`).catch(() => {});

  // Seed if no users exist. Prefer the rich seed (10 substitutes, 20
  // kindergartens, real assignments + absences) so the dashboard and ML
  // models have realistic data from day one. Fall back to the minimal
  // demo seed if the rich seed fails for any reason.
  const users = await query('SELECT COUNT(*)::int AS count FROM users');
  if (users.rows[0].count === 0) {
    console.log('🌱 Seeding demo data (full)...');
    try {
      const { seedFull } = await import('./seed-full');
      await seedFull();
    } catch (err) {
      console.error('⚠️  Full seed failed, falling back to minimal demo seed:', err);
      await seedData();
    }
  } else {
    console.log('ℹ️  Data already exists, skipping seed');
  }

  console.log('✅ Migration complete');
}

async function seedData() {
  const authorityResult = await query(`
    INSERT INTO authorities (name, city, district, contact_name, contact_email, contact_phone)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
  `, ['עיריית יקנעם עילית', 'יקנעם עילית', 'חיפה', 'שרה לוי', 'education@yokneam.muni.il', '04-9888100']);
  const authorityId = authorityResult.rows[0].id;

  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [authorityId, 'admin@machliphon.co.il', passwordHash, 'super_admin', 'מנהל', 'מערכת', '050-0000000']);

  await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [authorityId, 'director@yokneam.muni.il', passwordHash, 'authority_admin', 'דנה', 'כהן', '050-1111111']);

  const managerUserResult = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
  `, [authorityId, 'manager@yokneam.muni.il', passwordHash, 'manager', 'רחל', 'לוי', '050-2222222']);

  const managerResult = await query(`
    INSERT INTO managers (user_id, authority_id, employee_id, region)
    VALUES ($1, $2, $3, $4) RETURNING id
  `, [managerUserResult.rows[0].id, authorityId, 'EMP001', 'מרכז']);

  const sub1Result = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
  `, [authorityId, 'miriam@example.com', passwordHash, 'substitute', 'מרים', 'אברהם', '050-3333333']);

  const sub2Result = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
  `, [authorityId, 'ruth@example.com', passwordHash, 'substitute', 'רות', 'שמעון', '050-4444444']);

  const sub3Result = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
  `, [authorityId, 'sarah@example.com', passwordHash, 'substitute', 'שרה', 'יעקב', '050-5555555']);

  const nextYear = new Date().getFullYear() + 1;
  await query(`
    INSERT INTO substitutes (user_id, authority_id, id_number, birth_date, neighborhood, work_permit_valid, work_permit_expiry, education_level, years_experience, status)
    VALUES
    ($1, $2, '123456789', '1975-03-15', 'מרכז', true, $3, 'teacher', 8, 'active'),
    ($4, $5, '987654321', '1968-07-22', 'צפון', true, $6, 'assistant', 5, 'active'),
    ($7, $8, '456789123', '1980-11-10', 'דרום', false, null, 'teacher', 3, 'pending_approval')
  `, [
    sub1Result.rows[0].id, authorityId, `${nextYear}-12-31`,
    sub2Result.rows[0].id, authorityId, `${nextYear}-06-30`,
    sub3Result.rows[0].id, authorityId,
  ]);

  const kg1 = await query(`
    INSERT INTO kindergartens (authority_id, name, address, neighborhood, principal_name, phone, age_group, capacity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
  `, [authorityId, 'גן הפרחים', 'רחוב הורד 5', 'מרכז', 'נעמי גולד', '04-9888200', '3-6', 35]);

  const kg2 = await query(`
    INSERT INTO kindergartens (authority_id, name, address, neighborhood, principal_name, phone, age_group, capacity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
  `, [authorityId, 'גן הכוכבים', 'רחוב הנרקיס 12', 'צפון', 'אורית רוזן', '04-9888201', '0-3', 25]);

  const kg3 = await query(`
    INSERT INTO kindergartens (authority_id, name, address, neighborhood, principal_name, phone, age_group, capacity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
  `, [authorityId, 'גן הירח', 'רחוב הגפן 8', 'דרום', 'מיכל אהרון', '04-9888202', '3-6', 30]);

  await query(`
    INSERT INTO manager_kindergartens (manager_id, kindergarten_id) VALUES ($1, $2), ($1, $3)
  `, [managerResult.rows[0].id, kg1.rows[0].id, kg2.rows[0].id]);

  console.log('✅ Demo data seeded');
  console.log('  miriam@example.com / Demo1234!');
  console.log('  manager@yokneam.muni.il / Demo1234!');
  console.log('  director@yokneam.muni.il / Demo1234!');
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
