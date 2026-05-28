import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from './pool';
import pool from './pool';

// Fixed UUIDs so re-runs are idempotent
const AUTHORITY_ID = 'a1b2c3d4-0001-4000-8000-000000000001';
const ADMIN_USER_ID = 'a1b2c3d4-0002-4000-8000-000000000001';
const MANAGER_USER_ID = 'a1b2c3d4-0003-4000-8000-000000000001';
const MANAGER_PROFILE_ID = 'a1b2c3d4-0004-4000-8000-000000000001';

// ─── Helper utilities ────────────────────────────────────────────────────────

const fmt = (d: Date) => d.toISOString().split('T')[0];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Returns true if this date is a weekday in Israel (Sun-Thu) */
function isIsraeliWorkday(d: Date): boolean {
  const day = d.getDay(); // 0=Sun, 5=Fri, 6=Sat
  return day !== 5 && day !== 6;
}

/** Collect working days in a range [start, end] (inclusive) */
function workdaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (isIsraeliWorkday(cur)) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Static data ─────────────────────────────────────────────────────────────

const NEIGHBORHOODS = ['מרכז', 'צפון', 'דרום', 'מזרח', 'מערב', 'שכונה א', 'שכונה ב'];

const AGE_GROUPS = ['0-3', '3-6', 'mixed'];

const ABSENT_EMPLOYEE_NAMES = [
  'יעל כהן', 'חנה ברק', 'תמר שלום', 'רינה אברהם', 'נעמי גולד',
  'אורית לוי', 'מיכל שפירא', 'שרית מזרחי', 'ליאת דוד', 'אילנה רוזן',
];

const ABSENCE_REASONS = ['sick', 'vacation', 'emergency', 'known'];

const ABSENCE_ROLES = ['teacher', 'assistant'];

const KINDERGARTEN_NAMES: string[] = [
  'גן הדסה', 'גן אפרסמון', 'גן שושנה', 'גן כלנית', 'גן חבצלת',
  'גן דולב', 'גן רימון', 'גן תאנה', 'גן זית', 'גן ארז',
  'גן תמר', 'גן ורד', 'גן בוגנביליה', 'גן שקד', 'גן צבר',
  'גן אורן', 'גן אקליפטוס', 'גן ברוש', 'גן אלון', 'גן לימון',
  'גן תפוז', 'גן ענבים', 'גן אגוז', 'גן גפן', 'גן קנמון',
  'גן ציפורן', 'גן לבנדר', 'גן מנתה', 'גן בזיליקום', 'גן יסמין',
  'גן נרקיס', 'גן כרכום', 'גן חצב', 'גן קיקיון', 'גן שיזף',
  'גן פיקוס', 'גן סביון', 'גן חרצית', 'גן כלנית האדומה', 'גן דפנה',
  'גן קמומיל', 'גן שומר', 'גן שיח', 'גן פשפש', 'גן עירית',
  'גן בני ברק 1', 'גן בני ברק 2', 'גן בני ברק 3', 'גן בני ברק 4', 'גן בני ברק 5',
  'גן רחוב ביאליק', 'גן רחוב הרצל', 'גן רחוב ז\'בוטינסקי', 'גן רחוב בן גוריון', 'גן רחוב רוטשילד',
  'גן שכונת הדר', 'גן שכונת מזרח', 'גן שכונת צפון', 'גן שכונת דרום', 'גן שכונת מרכז',
  'גן אבן גבירול', 'גן מאפו', 'גן נורדאו', 'גן סוקולוב', 'גן אחוזה',
  'גן הגנה', 'גן השלום', 'גן האחדות', 'גן העצמאות', 'גן הציונות',
];

const HEBREW_FIRST_NAMES = [
  'יעל', 'חנה', 'תמר', 'רינה', 'נעמי', 'אורית', 'מיכל', 'שרית', 'ליאת', 'אילנה',
  'דינה', 'גלית', 'סיגל', 'רחל', 'לאה', 'מרים', 'רות', 'שרה', 'דבורה', 'אסתר',
];

const HEBREW_LAST_NAMES = [
  'כהן', 'לוי', 'מזרחי', 'ברק', 'שפירא', 'אברהם', 'גולד', 'רוזן', 'דוד', 'שלום',
  'פרץ', 'חדד', 'אוחיון', 'ביטון', 'אזולאי', 'בן דוד', 'שמעון', 'יעקב', 'נחום', 'גבאי',
];

const STREETS = [
  'רחוב הורד', 'שדרות הציונות', 'רחוב הנרקיס', 'רחוב הגפן', 'רחוב הגנה',
  'שדרות בן גוריון', 'רחוב ביאליק', 'רחוב הרצל', 'רחוב נורדאו', 'שדרות ז\'בוטינסקי',
  'רחוב רוטשילד', 'רחוב סוקולוב', 'רחוב אחד העם', 'רחוב יפה נוף', 'רחוב האורן',
];

// ─── Main seed function ───────────────────────────────────────────────────────

async function seedScale(): Promise<void> {
  console.log('Starting scale seed — בני ברק, 70 kindergartens...');

  const passwordHash = await bcrypt.hash('Scale1234!', 10);

  // 1. Authority (idempotent via fixed UUID)
  await query(`
    INSERT INTO authorities (id, name, city, district, contact_name, contact_email, contact_phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
  `, [
    AUTHORITY_ID,
    'רשות בני ברק',
    'בני ברק',
    'מרכז',
    'משה ישראלי',
    'education@bneibraq.muni.il',
    '03-6101234',
  ]);
  console.log('Authority ready.');

  // 2. Authority admin user (idempotent via fixed UUID)
  await query(`
    INSERT INTO users (id, authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
  `, [
    ADMIN_USER_ID,
    AUTHORITY_ID,
    'admin@scale-demo.local',
    passwordHash,
    'authority_admin',
    'דנה',
    'ישראלי',
    '050-1001001',
  ]);
  console.log('Admin user ready.');

  // 3. Manager user (idempotent via fixed UUID)
  await query(`
    INSERT INTO users (id, authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
  `, [
    MANAGER_USER_ID,
    AUTHORITY_ID,
    'manager@scale-demo.local',
    passwordHash,
    'manager',
    'רחל',
    'אדרי',
    '050-2002002',
  ]);
  console.log('Manager user ready.');

  // 4. Manager profile (idempotent via fixed UUID)
  await query(`
    INSERT INTO managers (id, user_id, authority_id, employee_id, region)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [
    MANAGER_PROFILE_ID,
    MANAGER_USER_ID,
    AUTHORITY_ID,
    'SC-MGR-001',
    'כלל הרשות',
  ]);
  console.log('Manager profile ready.');

  // 5. Substitute users + profiles (15 substitutes, idempotent via email ON CONFLICT)
  const substituteIds: string[] = [];

  for (let i = 1; i <= 15; i++) {
    const email = `sub${i}@scale-demo.local`;
    const firstName = HEBREW_FIRST_NAMES[(i - 1) % HEBREW_FIRST_NAMES.length];
    const lastName = HEBREW_LAST_NAMES[(i - 1) % HEBREW_LAST_NAMES.length];
    const phone = `054-${String(3000000 + i).substring(1)}`;

    const userRes = await query(`
      INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `, [AUTHORITY_ID, email, passwordHash, 'substitute', firstName, lastName, phone]);

    const userId = userRes.rows[0].id as string;

    const neighborhood = NEIGHBORHOODS[i % NEIGHBORHOODS.length];
    const hascar = i % 3 !== 0; // 2/3 have cars
    const maxDist = hascar ? randInt(20, 40) : randInt(10, 20);
    const prefNeighborhoods = pickRandomN(NEIGHBORHOODS, randInt(1, 3));
    const workPermitExpiry = fmt(addDays(new Date(), randInt(365, 730)));
    const idNumber = String(100000000 + i * 7);
    const birthYear = 1970 + (i % 20);
    const educationLevels = ['teacher', 'assistant', 'teacher', 'teacher', 'assistant'];
    const educationLevel = educationLevels[i % educationLevels.length];

    const subRes = await query(`
      INSERT INTO substitutes (
        user_id, authority_id, id_number, birth_date, address, neighborhood,
        work_permit_valid, work_permit_expiry, work_permit_number,
        education_level, years_experience,
        available_days, preferred_neighborhoods, max_distance_km,
        status, rating, total_assignments
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        true, $7, $8,
        $9, $10,
        '["Sunday","Monday","Tuesday","Wednesday","Thursday"]', $11, $12,
        'active', 0, 0
      )
      ON CONFLICT (id_number) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `, [
      userId,
      AUTHORITY_ID,
      idNumber,
      `${birthYear}-06-15`,
      `${pickRandom(STREETS)} ${i + 1}, בני ברק`,
      neighborhood,
      workPermitExpiry,
      `WP-SC-${String(i).padStart(3, '0')}`,
      educationLevel,
      randInt(1, 12),
      JSON.stringify(prefNeighborhoods),
      maxDist,
    ]);

    substituteIds.push(subRes.rows[0].id as string);
  }
  console.log(`${substituteIds.length} substitutes ready.`);

  // 6. Kindergartens (70, idempotent: delete scale seed's own KGs then re-insert)
  // We scope deletes strictly to this authority to avoid touching other data.
  // First, remove junction rows, then assignments/absences referencing these KGs,
  // then the KGs themselves — all within the authority scope.
  // Simpler approach: insert with ON CONFLICT on (authority_id, name) unique pair.
  // Schema has no unique constraint on (authority_id, name), so we use
  // DELETE + INSERT scoped to this authority.

  // Remove previously seeded data for this authority (scale seed only)
  console.log('Clearing previous scale-seed data for this authority...');

  // Clear in reverse FK order
  await query(`
    DELETE FROM notifications
    WHERE user_id IN (
      SELECT id FROM users WHERE authority_id = $1
    )
  `, [AUTHORITY_ID]);

  await query(`
    DELETE FROM assignments
    WHERE kindergarten_id IN (
      SELECT id FROM kindergartens WHERE authority_id = $1
    )
  `, [AUTHORITY_ID]);

  await query(`
    DELETE FROM absence_reports
    WHERE kindergarten_id IN (
      SELECT id FROM kindergartens WHERE authority_id = $1
    )
  `, [AUTHORITY_ID]);

  await query(`
    DELETE FROM known_absences
    WHERE kindergarten_id IN (
      SELECT id FROM kindergartens WHERE authority_id = $1
    )
  `, [AUTHORITY_ID]);

  await query(`
    DELETE FROM manager_kindergartens
    WHERE manager_id = $1
  `, [MANAGER_PROFILE_ID]);

  await query(`
    DELETE FROM kindergartens WHERE authority_id = $1
  `, [AUTHORITY_ID]);

  console.log('Previous scale data cleared. Inserting kindergartens...');

  const kindergartenIds: string[] = [];

  for (let i = 0; i < 70; i++) {
    const name = KINDERGARTEN_NAMES[i];
    const neighborhood = NEIGHBORHOODS[i % NEIGHBORHOODS.length];
    const ageGroup = AGE_GROUPS[i % AGE_GROUPS.length];
    const capacity = randInt(20, 35);
    const principalFirstName = HEBREW_FIRST_NAMES[(i * 3) % HEBREW_FIRST_NAMES.length];
    const principalLastName = HEBREW_LAST_NAMES[(i * 7) % HEBREW_LAST_NAMES.length];
    const principalName = `${principalFirstName} ${principalLastName}`;
    const streetNum = randInt(1, 50);
    const street = STREETS[i % STREETS.length];
    const address = `${street} ${streetNum}, בני ברק`;
    const phone = `03-${String(6100000 + i * 13 + 200).substring(1)}`;

    const kgRes = await query(`
      INSERT INTO kindergartens (authority_id, name, address, neighborhood, principal_name, phone, age_group, capacity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [AUTHORITY_ID, name, address, neighborhood, principalName, phone, ageGroup, capacity]);

    kindergartenIds.push(kgRes.rows[0].id as string);
  }
  console.log(`${kindergartenIds.length} kindergartens inserted.`);

  // 7. Link manager to all 70 kindergartens
  for (const kgId of kindergartenIds) {
    await query(`
      INSERT INTO manager_kindergartens (manager_id, kindergarten_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [MANAGER_PROFILE_ID, kgId]);
  }

  // Update manager's count
  await query(`
    UPDATE managers SET managed_kindergartens_count = $1 WHERE id = $2
  `, [kindergartenIds.length, MANAGER_PROFILE_ID]);
  console.log('Manager linked to all 70 kindergartens.');

  // 8. Historical absences + assignments — past 90 workdays
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ninetyDaysAgo = addDays(today, -90);
  const pastWorkdays = workdaysInRange(ninetyDaysAgo, addDays(today, -1));

  console.log(`Generating absences for ${pastWorkdays.length} past workdays...`);

  let totalAssignmentCounts: Record<string, number> = {};
  substituteIds.forEach(id => { totalAssignmentCounts[id] = 0; });

  let absenceCount = 0;
  let assignmentCount = 0;

  for (const day of pastWorkdays) {
    const dayStr = fmt(day);
    const numAbsences = randInt(0, 3);

    for (let a = 0; a < numAbsences; a++) {
      const kgId = pickRandom(kindergartenIds);
      const employeeName = pickRandom(ABSENT_EMPLOYEE_NAMES);
      const role = pickRandom(ABSENCE_ROLES);
      const reason = pickRandom(ABSENCE_REASONS);

      // Status distribution: ~60% covered, ~20% open, ~20% cancelled
      const roll = Math.random();
      let status: string;
      if (roll < 0.60) {
        status = 'covered';
      } else if (roll < 0.80) {
        status = 'open';
      } else {
        status = 'uncovered'; // past uncovered = no substitute found
      }

      const absenceRes = await query(`
        INSERT INTO absence_reports (
          kindergarten_id, reported_by, absent_employee_name, absent_employee_role,
          absence_date, absence_reason, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [kgId, MANAGER_USER_ID, employeeName, role, dayStr, reason, status]);

      const absenceId = absenceRes.rows[0].id as string;
      absenceCount++;

      if (status === 'covered') {
        const substituteId = pickRandom(substituteIds);

        await query(`
          INSERT INTO assignments (
            absence_id, substitute_id, kindergarten_id, assigned_by,
            assignment_date, start_time, end_time,
            status, hours_worked, hourly_rate, total_pay,
            substitute_confirmed_at, substitute_arrived_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, '07:30', '14:00',
            'completed', 6.5, 48.00, 312.00,
            $6::timestamptz, $6::timestamptz
          )
        `, [
          absenceId,
          substituteId,
          kgId,
          ADMIN_USER_ID,
          dayStr,
          `${dayStr}T07:30:00Z`,
        ]);

        assignmentCount++;
        totalAssignmentCounts[substituteId] = (totalAssignmentCounts[substituteId] ?? 0) + 1;
      }
    }
  }

  console.log(`Historical: ${absenceCount} absences, ${assignmentCount} assignments inserted.`);

  // 9. Upcoming absences — next 14 workdays
  const fourteenDaysOut = addDays(today, 14);
  const upcomingWorkdays = workdaysInRange(today, fourteenDaysOut);

  console.log(`Generating upcoming absences for ${upcomingWorkdays.length} workdays...`);

  let upcomingAbsenceCount = 0;
  let upcomingAssignmentCount = 0;

  for (const day of upcomingWorkdays) {
    const dayStr = fmt(day);
    const numAbsences = randInt(1, 3);

    for (let a = 0; a < numAbsences; a++) {
      const kgId = pickRandom(kindergartenIds);
      const employeeName = pickRandom(ABSENT_EMPLOYEE_NAMES);
      const role = pickRandom(ABSENCE_ROLES);
      const reason = pickRandom(ABSENCE_REASONS);

      // Mix: ~40% have confirmed assignment, ~60% open
      const hasAssignment = Math.random() < 0.40;
      const status = hasAssignment ? 'assigned' : 'open';

      const absenceRes = await query(`
        INSERT INTO absence_reports (
          kindergarten_id, reported_by, absent_employee_name, absent_employee_role,
          absence_date, absence_reason, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [kgId, MANAGER_USER_ID, employeeName, role, dayStr, reason, status]);

      const absenceId = absenceRes.rows[0].id as string;
      upcomingAbsenceCount++;

      if (hasAssignment) {
        const substituteId = pickRandom(substituteIds);

        await query(`
          INSERT INTO assignments (
            absence_id, substitute_id, kindergarten_id, assigned_by,
            assignment_date, start_time, end_time,
            status, hourly_rate,
            substitute_confirmed_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, '07:30', '14:00',
            'confirmed', 48.00,
            NOW()
          )
        `, [
          absenceId,
          substituteId,
          kgId,
          ADMIN_USER_ID,
          dayStr,
        ]);

        upcomingAssignmentCount++;
        totalAssignmentCounts[substituteId] = (totalAssignmentCounts[substituteId] ?? 0) + 1;
      }
    }
  }

  console.log(`Upcoming: ${upcomingAbsenceCount} absences, ${upcomingAssignmentCount} assignments inserted.`);

  // 10. Update total_assignments counts on substitutes
  for (const [subId, count] of Object.entries(totalAssignmentCounts)) {
    if (count > 0) {
      // Also set a realistic rating based on volume
      const rating = 3.5 + Math.random() * 1.5; // 3.5 – 5.0
      await query(`
        UPDATE substitutes SET total_assignments = $1, rating = $2 WHERE id = $3
      `, [count, parseFloat(rating.toFixed(2)), subId]);
    }
  }
  console.log('Substitute total_assignments counts updated.');

  // 11. Notifications for admin (5 unread)
  const notificationTemplates = [
    { type: 'assignment_request', title: 'שיבוץ ממתין לאישור', message: 'נדרש שיבוץ לגן הדסה מחר. יש 3 מחליפות זמינות.' },
    { type: 'permit_expiring', title: 'תיק עובד פג תוקף', message: 'תיק העובד של יעל כהן יפוג בעוד 30 יום.' },
    { type: 'assignment_confirmed', title: 'שיבוץ אושר', message: 'המחליפה רחל אדרי אישרה את השיבוץ לגן שושנה.' },
    { type: 'absence_reported', title: 'דיווח היעדרות חדש', message: 'דווחה היעדרות בגן כלנית לתאריך מחר.' },
    { type: 'permit_expiring', title: 'שתי מחליפות עם תיק עובד לחידוש', message: '2 מחליפות נדרשות לחדש תיק עובד עד סוף החודש.' },
  ];

  for (const notif of notificationTemplates) {
    await query(`
      INSERT INTO notifications (user_id, type, title, message, is_read)
      VALUES ($1, $2, $3, $4, false)
    `, [ADMIN_USER_ID, notif.type, notif.title, notif.message]);
  }
  console.log('5 notifications created for admin.');

  // Summary
  console.log('');
  console.log('Scale seed complete.');
  console.log('  Authority:       רשות בני ברק');
  console.log('  Kindergartens:   70');
  console.log('  Substitutes:     15');
  console.log(`  Past absences:   ${absenceCount}`);
  console.log(`  Past assignments: ${assignmentCount}`);
  console.log(`  Upcoming absences: ${upcomingAbsenceCount}`);
  console.log(`  Upcoming assignments: ${upcomingAssignmentCount}`);
  console.log('');
  console.log('Login credentials (password: Scale1234!):');
  console.log('  Authority Admin: admin@scale-demo.local');
  console.log('  Manager:         manager@scale-demo.local');
  console.log('  Substitutes:     sub1@scale-demo.local  ..  sub15@scale-demo.local');
}

async function main(): Promise<void> {
  try {
    await seedScale();
  } catch (err) {
    console.error('Scale seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
