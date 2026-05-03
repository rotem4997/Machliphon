import bcrypt from 'bcryptjs';
import { query } from './pool';
import pool from './pool';

export const DEMO_EMAILS = [
  'admin@machliphon.co.il',
  'director@yokneam.muni.il',
  'manager@yokneam.muni.il',
  'miriam@example.com',
  'ruth@example.com',
  'sarah@example.com',
];

export async function resetDemoPasswords() {
  const hash = await bcrypt.hash('Demo1234!', 12);
  const result = await query(
    `UPDATE users SET password_hash = $1 WHERE email = ANY($2::text[])`,
    [hash, DEMO_EMAILS],
  );
  if ((result.rowCount ?? 0) > 0) {
    console.log(`🔑 Reset password for ${result.rowCount} demo account(s) → Demo1234!`);
  }
  return result.rowCount ?? 0;
}

export async function seedData() {
  console.log('🌱 Seeding database...');

  // 1. Authority
  const authorityResult = await query(`
    INSERT INTO authorities (name, city, district, contact_name, contact_email, contact_phone)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT DO NOTHING
    RETURNING id
  `, ['עיריית יקנעם עילית', 'יקנעם עילית', 'חיפה', 'שרה לוי', 'education@yokneam.muni.il', '04-9888100']);

  const authorityId = authorityResult.rows[0]?.id;
  if (!authorityId) {
    console.log('ℹ️  Authority already exists, skipping seed.');
    return;
  }

  // 2. Users
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [authorityId, 'admin@machliphon.co.il', passwordHash, 'super_admin', 'מנהל', 'מערכת', '050-0000000']);

  const authAdminResult = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [authorityId, 'director@yokneam.muni.il', passwordHash, 'authority_admin', 'דנה', 'כהן', '050-1111111']);

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

  const managerId = managerResult.rows[0].id;

  // 3. Substitute users
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

  // 4. Substitute profiles
  const nextYear = new Date().getFullYear() + 1;

  const sub1SubResult = await query(`
    INSERT INTO substitutes (
      user_id, authority_id, id_number, birth_date, address, neighborhood,
      work_permit_valid, work_permit_expiry, work_permit_number,
      education_level, years_experience,
      available_days, preferred_neighborhoods, max_distance_km,
      status, rating, total_assignments
    ) VALUES ($1, $2, '123456789', '1975-03-15', 'רחוב הורד 3 יקנעם', 'מרכז',
              true, $3, 'WP-001',
              'teacher', 8,
              '["Sunday","Monday","Tuesday","Wednesday","Thursday"]', '["מרכז","צפון"]', 10,
              'active', 4.5, 12)
    RETURNING id
  `, [sub1Result.rows[0].id, authorityId, `${nextYear}-12-31`]);

  const sub2SubResult = await query(`
    INSERT INTO substitutes (
      user_id, authority_id, id_number, birth_date, address, neighborhood,
      work_permit_valid, work_permit_expiry, work_permit_number,
      education_level, years_experience,
      available_days, preferred_neighborhoods, max_distance_km,
      status, rating, total_assignments
    ) VALUES ($1, $2, '987654321', '1968-07-22', 'שדרות הצבאים 10 יקנעם', 'צפון',
              true, $3, 'WP-002',
              'assistant', 5,
              '["Sunday","Monday","Wednesday","Thursday"]', '["צפון","מרכז"]', 8,
              'active', 4.2, 7)
    RETURNING id
  `, [sub2Result.rows[0].id, authorityId, `${nextYear}-06-30`]);

  const sub3SubResult = await query(`
    INSERT INTO substitutes (
      user_id, authority_id, id_number, birth_date, address, neighborhood,
      work_permit_valid, work_permit_expiry,
      education_level, years_experience,
      available_days, preferred_neighborhoods, max_distance_km,
      status, rating, total_assignments
    ) VALUES ($1, $2, '456789123', '1980-11-10', 'רחוב הגפן 7 יקנעם', 'דרום',
              false, null,
              'teacher', 3,
              '["Monday","Tuesday","Wednesday","Thursday"]', '["דרום"]', 6,
              'pending_approval', 0, 0)
    RETURNING id
  `, [sub3Result.rows[0].id, authorityId]);

  const sub1Id = sub1SubResult.rows[0].id;
  const sub2Id = sub2SubResult.rows[0].id;

  // 5. Kindergartens
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

  const kg1Id = kg1.rows[0].id;
  const kg2Id = kg2.rows[0].id;
  const kg3Id = kg3.rows[0].id;

  // 6. Link manager to kindergartens
  await query(`
    INSERT INTO manager_kindergartens (manager_id, kindergarten_id) VALUES ($1, $2), ($1, $3)
  `, [managerId, kg1Id, kg2Id]);

  // 7. Known absences
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  await query(`
    INSERT INTO known_absences (kindergarten_id, employee_name, employee_role, start_date, end_date, reason, notes, created_by)
    VALUES
    ($1, 'לאה ברכה', 'teacher', $3, $4, 'maternity', 'חופשת לידה', $2),
    ($5, 'יפית מזרחי', 'assistant', $6, $7, 'military', 'מילואים', $2)
  `, [
    kg1Id,
    authAdminResult.rows[0].id,
    fmt(today),
    fmt(new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)),
    kg3Id,
    fmt(nextMonth),
    fmt(new Date(nextMonth.getTime() + 14 * 24 * 60 * 60 * 1000)),
  ]);

  // 8. Absence reports
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const absence1 = await query(`
    INSERT INTO absence_reports (kindergarten_id, reported_by, absent_employee_name, absent_employee_role, absence_date, absence_reason, notes, status)
    VALUES ($1, $2, 'לאה ברכה', 'teacher', $3, 'sick', 'מחלה פתאומית', 'assigned')
    RETURNING id
  `, [kg1Id, managerUserResult.rows[0].id, fmt(yesterday)]);

  const absence2 = await query(`
    INSERT INTO absence_reports (kindergarten_id, reported_by, absent_employee_name, absent_employee_role, absence_date, absence_reason, notes, status)
    VALUES ($1, $2, 'ענת שפירא', 'teacher', $3, 'sick', 'מחלה', 'open')
    RETURNING id
  `, [kg2Id, managerUserResult.rows[0].id, fmt(today)]);

  // 9. Assignments
  await query(`
    INSERT INTO assignments (
      absence_id, substitute_id, kindergarten_id, assigned_by,
      assignment_date, start_time, end_time,
      status, hours_worked, hourly_rate, total_pay, notes
    ) VALUES
    ($1, $2, $3, $4, $5, '07:30', '14:00', 'completed', 6.5, 45.00, 292.50, 'שיבוץ ראשון'),
    ($6, $7, $8, $4, $9, '07:30', '14:00', 'confirmed', null, 45.00, null, null)
  `, [
    absence1.rows[0].id, sub1Id, kg1Id, managerUserResult.rows[0].id, fmt(yesterday),
    absence2.rows[0].id, sub2Id, kg2Id, fmt(today),
  ]);

  await query(`UPDATE substitutes SET total_assignments = 1 WHERE id = $1`, [sub1Id]);

  // 10. Substitute availability
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  await query(`
    INSERT INTO substitute_availability (substitute_id, date, is_available, reason)
    VALUES
    ($1, $2, false, 'vacation'),
    ($3, $4, false, 'personal')
  `, [
    sub1Id, fmt(tomorrow),
    sub2Id, fmt(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)),
  ]);

  console.log('✅ Seed data created successfully!');
  console.log('\n📋 Test accounts:');
  console.log('  Super Admin:  admin@machliphon.co.il     / Demo1234!');
  console.log('  Authority:    director@yokneam.muni.il   / Demo1234!');
  console.log('  Manager:      manager@yokneam.muni.il    / Demo1234!');
  console.log('  Substitute 1: miriam@example.com         / Demo1234!');
  console.log('  Substitute 2: ruth@example.com           / Demo1234!');
  console.log('  Substitute 3: sarah@example.com          / Demo1234!  (pending_approval)');
}

// CLI entry point: ts-node src/db/seed.ts
async function seed() {
  await seedData();
  await pool.end();
}

seed().catch(console.error);
