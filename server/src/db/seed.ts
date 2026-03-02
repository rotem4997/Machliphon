import bcrypt from 'bcryptjs';
import { query } from './pool';
import pool from './pool';

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create authority
  const authorityResult = await query(`
    INSERT INTO authorities (name, city, district, contact_name, contact_email, contact_phone)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT DO NOTHING
    RETURNING id
  `, ['עיריית יקנעם עילית', 'יקנעם עילית', 'חיפה', 'שרה לוי', 'education@yokneam.muni.il', '04-9888100']);

  const authorityId = authorityResult.rows[0]?.id;
  if (!authorityId) { console.log('Authority already exists, skipping...'); await pool.end(); return; }

  // 2. Create users
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  // Super admin
  await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [authorityId, 'admin@machliphon.co.il', passwordHash, 'super_admin', 'מנהל', 'מערכת', '050-0000000']);

  // Authority admin
  const authAdminResult = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [authorityId, 'director@yokneam.muni.il', passwordHash, 'authority_admin', 'דנה', 'כהן', '050-1111111']);

  // Manager
  const managerUserResult = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [authorityId, 'manager@yokneam.muni.il', passwordHash, 'manager', 'רחל', 'לוי', '050-2222222']);

  const managerResult = await query(`
    INSERT INTO managers (user_id, authority_id, employee_id, region)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [managerUserResult.rows[0].id, authorityId, 'EMP001', 'מרכז']);

  // Substitutes
  const sub1Result = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [authorityId, 'miriam@example.com', passwordHash, 'substitute', 'מרים', 'אברהם', '050-3333333']);

  const sub2Result = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [authorityId, 'ruth@example.com', passwordHash, 'substitute', 'רות', 'שמעון', '050-4444444']);

  const sub3Result = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [authorityId, 'sarah@example.com', passwordHash, 'substitute', 'שרה', 'יעקב', '050-5555555']);

  // Substitute profiles
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
    sub3Result.rows[0].id, authorityId
  ]);

  // Kindergartens
  const kg1 = await query(`
    INSERT INTO kindergartens (authority_id, name, address, neighborhood, principal_name, phone, age_group, capacity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [authorityId, 'גן הפרחים', 'רחוב הורד 5', 'מרכז', 'נעמי גולד', '04-9888200', '3-6', 35]);

  const kg2 = await query(`
    INSERT INTO kindergartens (authority_id, name, address, neighborhood, principal_name, phone, age_group, capacity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [authorityId, 'גן הכוכבים', 'רחוב הנרקיס 12', 'צפון', 'אורית רוזן', '04-9888201', '0-3', 25]);

  const kg3 = await query(`
    INSERT INTO kindergartens (authority_id, name, address, neighborhood, principal_name, phone, age_group, capacity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [authorityId, 'גן הירח', 'רחוב הגפן 8', 'דרום', 'מיכל אהרון', '04-9888202', '3-6', 30]);

  // Link manager to kindergartens
  await query(`
    INSERT INTO manager_kindergartens (manager_id, kindergarten_id) VALUES ($1, $2), ($1, $3)
  `, [managerResult.rows[0].id, kg1.rows[0].id, kg2.rows[0].id]);

  console.log('✅ Seed data created successfully!');
  console.log('\n📋 Test accounts:');
  console.log('  Super Admin:  admin@machliphon.co.il     / Demo1234!');
  console.log('  Authority:    director@yokneam.muni.il   / Demo1234!');
  console.log('  Manager:      manager@yokneam.muni.il    / Demo1234!');
  console.log('  Substitute 1: miriam@example.com         / Demo1234!');
  console.log('  Substitute 2: ruth@example.com           / Demo1234!');

  await pool.end();
}

seed().catch(console.error);
