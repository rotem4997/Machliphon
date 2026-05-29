/**
 * seed-test-users.ts
 *
 * Creates three ready-to-use test accounts tied to the scale-demo authority.
 * Safe to re-run (all inserts are ON CONFLICT DO NOTHING or DO UPDATE).
 *
 * Prerequisites: seed-scale.ts must have been run first (authority must exist).
 *
 * Credentials
 * -----------
 * Authority Admin : admin@test.local      / TestAdmin1!
 * Manager         : manager@test.local    / TestManager1!
 * Substitute      : substitute@test.local / TestSub1!
 */

import bcrypt from 'bcryptjs';
import { query } from './pool';
import pool from './pool';

const AUTHORITY_ID = 'a1b2c3d4-0001-4000-8000-000000000001'; // created by seed-scale

// Fixed UUIDs — idempotent across runs
const ADMIN_ID   = 'b2c3d4e5-0001-4000-8000-000000000001';
const MANAGER_ID = 'b2c3d4e5-0002-4000-8000-000000000001';
const SUB_ID     = 'b2c3d4e5-0003-4000-8000-000000000001';

async function seedTestUsers(): Promise<void> {
  console.log('🧪 Creating test users...');

  const adminHash   = await bcrypt.hash('TestAdmin1!',   10);
  const managerHash = await bcrypt.hash('TestManager1!', 10);
  const subHash     = await bcrypt.hash('TestSub1!',     10);

  // ── Authority Admin ───────────────────────────────────────────────────────
  await query(`
    INSERT INTO users (id, authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, 'admin@test.local', $3, 'authority_admin', 'Admin', 'Test', '050-0000001')
    ON CONFLICT (id) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      email         = EXCLUDED.email,
      updated_at    = NOW()
  `, [ADMIN_ID, AUTHORITY_ID, adminHash]);

  // ── Manager ───────────────────────────────────────────────────────────────
  await query(`
    INSERT INTO users (id, authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, 'manager@test.local', $3, 'manager', 'Dana', 'Manager', '050-0000002')
    ON CONFLICT (id) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      email         = EXCLUDED.email,
      updated_at    = NOW()
  `, [MANAGER_ID, AUTHORITY_ID, managerHash]);

  // Manager profile row (required to scope KG access)
  await query(`
    INSERT INTO managers (id, user_id, authority_id, region)
    VALUES ('b2c3d4e5-0004-4000-8000-000000000001', $1, $2, 'מרכז')
    ON CONFLICT (user_id) DO NOTHING
  `, [MANAGER_ID, AUTHORITY_ID]);

  // Assign all authority kindergartens to this manager
  await query(`
    INSERT INTO manager_kindergartens (manager_id, kindergarten_id)
    SELECT 'b2c3d4e5-0004-4000-8000-000000000001', id
    FROM kindergartens
    WHERE authority_id = $1 AND is_active = true
    ON CONFLICT DO NOTHING
  `, [AUTHORITY_ID]);

  // ── Substitute ────────────────────────────────────────────────────────────
  await query(`
    INSERT INTO users (id, authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, 'substitute@test.local', $3, 'substitute', 'Miri', 'Substitute', '050-0000003')
    ON CONFLICT (id) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      email         = EXCLUDED.email,
      updated_at    = NOW()
  `, [SUB_ID, AUTHORITY_ID, subHash]);

  // Substitute profile row
  await query(`
    INSERT INTO substitutes (
      user_id, authority_id, status, work_permit_valid, work_permit_expiry,
      has_car, max_distance_km, total_assignments, rating
    )
    VALUES ($1, $2, 'active', true, '2027-12-31', true, 30, 0, 4.5)
    ON CONFLICT (user_id) DO NOTHING
  `, [SUB_ID, AUTHORITY_ID]);

  console.log('');
  console.log('✅ Test users ready:');
  console.log('');
  console.log('  Role              Email                    Password');
  console.log('  ────────────────  ───────────────────────  ──────────────');
  console.log('  authority_admin   admin@test.local         TestAdmin1!');
  console.log('  manager           manager@test.local       TestManager1!');
  console.log('  substitute        substitute@test.local    TestSub1!');
  console.log('');
  console.log('  Authority: רשות בני ברק (id: ' + AUTHORITY_ID + ')');
  console.log('  The manager account is assigned to all kindergartens in the authority.');
}

seedTestUsers()
  .then(() => pool.end())
  .catch(err => {
    console.error('Test user seed failed:', err);
    pool.end();
    process.exit(1);
  });
