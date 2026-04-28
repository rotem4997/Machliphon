/**
 * seed-full.ts
 * Full database seed: 1 authority, 1 admin, 2 managers (each with 10 kindergartens),
 * 10 substitutes, absences, assignments, notifications.
 *
 * Run: ts-node src/db/seed-full.ts
 */

import bcrypt from 'bcryptjs';
import { query } from './pool';
import pool from './pool';

const DEFAULT_PASSWORD = 'Demo1234!';

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  console.log('🌱  Starting full seed...');

  // ──────────────────────────────────────────────
  // AUTHORITY
  // ──────────────────────────────────────────────
  const authRes = await query(`
    INSERT INTO authorities (name, name_en, city, district, contact_name, contact_email, contact_phone)
    VALUES ('רשות הנגב', 'Negev Authority', 'באר שבע', 'דרום', 'דוד לוי', 'david.levi@negev.gov.il', '08-9000000')
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  let authorityId: string;
  if (authRes.rows.length > 0) {
    authorityId = authRes.rows[0].id;
  } else {
    const existing = await query(`SELECT id FROM authorities WHERE name_en = 'Negev Authority' LIMIT 1`);
    authorityId = existing.rows[0].id;
  }
  console.log(`  ✓ Authority: ${authorityId}`);

  // ──────────────────────────────────────────────
  // AUTHORITY ADMIN
  // ──────────────────────────────────────────────
  const adminEmail = 'admin@negev.gov.il';
  let adminId: string;
  const existingAdmin = await query(`SELECT id FROM users WHERE email = $1`, [adminEmail]);
  if (existingAdmin.rows.length === 0) {
    const r = await query(`
      INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, 'authority_admin', 'דוד', 'לוי', '050-1000001')
      RETURNING id
    `, [authorityId, adminEmail, hash]);
    adminId = r.rows[0].id;
  } else {
    adminId = existingAdmin.rows[0].id;
  }
  console.log(`  ✓ Authority Admin: ${adminEmail}`);

  // ──────────────────────────────────────────────
  // 20 KINDERGARTENS (10 per manager)
  // ──────────────────────────────────────────────
  const kindergartenDefs = [
    // Manager 1 — North Zone (10 kindergartens)
    { name: 'גן חבצלת', address: 'רחוב הרצל 15, באר שבע', neighborhood: 'צפון', principal: 'מרים כהן', phone: '08-9100001' },
    { name: 'גן נרקיס', address: 'רחוב ויצמן 8, באר שבע', neighborhood: 'צפון', principal: 'רחל לוי', phone: '08-9100002' },
    { name: 'גן רקפת', address: 'שדרות בן גוריון 22, באר שבע', neighborhood: 'צפון', principal: 'שרה אבן', phone: '08-9100003' },
    { name: 'גן כלנית', address: 'רחוב סוקולוב 3, באר שבע', neighborhood: 'צפון', principal: 'יונה ברק', phone: '08-9100004' },
    { name: 'גן דליה', address: 'רחוב ז׳בוטינסקי 11, באר שבע', neighborhood: 'צפון', principal: 'נועה שמיר', phone: '08-9100005' },
    { name: 'גן שושנה', address: 'רחוב הגפן 5, באר שבע', neighborhood: 'צפון', principal: 'תמר יפה', phone: '08-9100006' },
    { name: 'גן יסמין', address: 'רחוב העצמאות 19, באר שבע', neighborhood: 'צפון', principal: 'אורה בן דוד', phone: '08-9100007' },
    { name: 'גן אורכידאה', address: 'רחוב בלפור 7, באר שבע', neighborhood: 'צפון', principal: 'גילה שטרן', phone: '08-9100008' },
    { name: 'גן פרג', address: 'רחוב אחד העם 14, באר שבע', neighborhood: 'צפון', principal: 'חנה מזרחי', phone: '08-9100009' },
    { name: 'גן לוטוס', address: 'רחוב אלנבי 2, באר שבע', neighborhood: 'צפון', principal: 'ענת כץ', phone: '08-9100010' },
    // Manager 2 — South Zone (10 kindergartens)
    { name: 'גן ורד', address: 'רחוב הנביאים 33, עומר', neighborhood: 'דרום', principal: 'דבורה חיים', phone: '08-9200001' },
    { name: 'גן צבעוני', address: 'רחוב האחווה 6, עומר', neighborhood: 'דרום', principal: 'פנינה רוזן', phone: '08-9200002' },
    { name: 'גן ציפורית', address: 'רחוב השחר 9, עומר', neighborhood: 'דרום', principal: 'אילנה גולן', phone: '08-9200003' },
    { name: 'גן אביב', address: 'שדרות האורן 12, עומר', neighborhood: 'דרום', principal: 'זיוה פרידמן', phone: '08-9200004' },
    { name: 'גן זוהר', address: 'רחוב הורד 4, עומר', neighborhood: 'דרום', principal: 'ליאת נחום', phone: '08-9200005' },
    { name: 'גן אלומות', address: 'רחוב הכלנית 18, עומר', neighborhood: 'דרום', principal: 'שלומית ירון', phone: '08-9200006' },
    { name: 'גן שחר', address: 'רחוב הזית 25, עומר', neighborhood: 'דרום', principal: 'ריבה פנחס', phone: '08-9200007' },
    { name: 'גן דבורה', address: 'רחוב הגנים 37, עומר', neighborhood: 'דרום', principal: 'שושנה עמר', phone: '08-9200008' },
    { name: 'גן תמרים', address: 'רחוב הרימון 8, עומר', neighborhood: 'דרום', principal: 'ברכה שוחט', phone: '08-9200009' },
    { name: 'גן נוות שאנן', address: 'רחוב השקד 16, עומר', neighborhood: 'דרום', principal: 'מינה אביב', phone: '08-9200010' },
  ];

  const kgIds: string[] = [];
  for (const kg of kindergartenDefs) {
    const existing = await query(`SELECT id FROM kindergartens WHERE name = $1 AND authority_id = $2`, [kg.name, authorityId]);
    if (existing.rows.length > 0) {
      kgIds.push(existing.rows[0].id);
    } else {
      const r = await query(`
        INSERT INTO kindergartens (authority_id, name, address, neighborhood, principal_name, phone, age_group)
        VALUES ($1, $2, $3, $4, $5, $6, '3-6')
        RETURNING id
      `, [authorityId, kg.name, kg.address, kg.neighborhood, kg.principal, kg.phone]);
      kgIds.push(r.rows[0].id);
    }
  }
  console.log(`  ✓ 20 Kindergartens created`);

  // ──────────────────────────────────────────────
  // MANAGER 1 — North Zone
  // ──────────────────────────────────────────────
  const mgr1Email = 'manager1@negev.gov.il';
  let mgr1UserId: string;
  let mgr1Id: string;

  const existingMgr1 = await query(`SELECT id FROM users WHERE email = $1`, [mgr1Email]);
  if (existingMgr1.rows.length === 0) {
    const uRes = await query(`
      INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, 'manager', 'ציפורה', 'מנחם', '050-2000001')
      RETURNING id
    `, [authorityId, mgr1Email, hash]);
    mgr1UserId = uRes.rows[0].id;
    const mRes = await query(`
      INSERT INTO managers (user_id, authority_id, employee_id, region, managed_kindergartens_count)
      VALUES ($1, $2, 'EMP-001', 'צפון', 10) RETURNING id
    `, [mgr1UserId, authorityId]);
    mgr1Id = mRes.rows[0].id;
  } else {
    mgr1UserId = existingMgr1.rows[0].id;
    const mRes = await query(`SELECT id FROM managers WHERE user_id = $1`, [mgr1UserId]);
    mgr1Id = mRes.rows[0].id;
  }

  // Assign first 10 kindergartens to manager 1
  for (const kgId of kgIds.slice(0, 10)) {
    await query(`
      INSERT INTO manager_kindergartens (manager_id, kindergarten_id) VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [mgr1Id, kgId]);
  }
  console.log(`  ✓ Manager 1 (ציפורה מנחם): ${mgr1Email} → 10 kindergartens`);

  // ──────────────────────────────────────────────
  // MANAGER 2 — South Zone
  // ──────────────────────────────────────────────
  const mgr2Email = 'manager2@negev.gov.il';
  let mgr2UserId: string;
  let mgr2Id: string;

  const existingMgr2 = await query(`SELECT id FROM users WHERE email = $1`, [mgr2Email]);
  if (existingMgr2.rows.length === 0) {
    const uRes = await query(`
      INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, 'manager', 'רחל', 'שפירא', '050-2000002')
      RETURNING id
    `, [authorityId, mgr2Email, hash]);
    mgr2UserId = uRes.rows[0].id;
    const mRes = await query(`
      INSERT INTO managers (user_id, authority_id, employee_id, region, managed_kindergartens_count)
      VALUES ($1, $2, 'EMP-002', 'דרום', 10) RETURNING id
    `, [mgr2UserId, authorityId]);
    mgr2Id = mRes.rows[0].id;
  } else {
    mgr2UserId = existingMgr2.rows[0].id;
    const mRes = await query(`SELECT id FROM managers WHERE user_id = $1`, [mgr2UserId]);
    mgr2Id = mRes.rows[0].id;
  }

  // Assign last 10 kindergartens to manager 2
  for (const kgId of kgIds.slice(10, 20)) {
    await query(`
      INSERT INTO manager_kindergartens (manager_id, kindergarten_id) VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [mgr2Id, kgId]);
  }
  console.log(`  ✓ Manager 2 (רחל שפירא): ${mgr2Email} → 10 kindergartens`);

  // ──────────────────────────────────────────────
  // 10 SUBSTITUTES
  // ──────────────────────────────────────────────
  const substituteDefs = [
    { first: 'שרה', last: 'כהן', email: 'sarah.cohen@demo.il', phone: '054-1000001', id: '123456789', city: 'באר שבע', neighborhood: 'צפון', edu: 'תואר ראשון בחינוך', status: 'active', permitValid: true, expiry: '2028-01-01' },
    { first: 'מירה', last: 'לוי', email: 'mira.levi@demo.il', phone: '054-1000002', id: '234567890', city: 'עומר', neighborhood: 'דרום', edu: 'עוזרת גננת', status: 'active', permitValid: true, expiry: '2027-06-15' },
    { first: 'רינה', last: 'אבן', email: 'rina.aven@demo.il', phone: '054-1000003', id: '345678901', city: 'באר שבע', neighborhood: 'צפון', edu: 'מטפלת ילדים', status: 'active', permitValid: true, expiry: '2026-12-31' },
    { first: 'דנה', last: 'שפיר', email: 'dana.shapir@demo.il', phone: '054-1000004', id: '456789012', city: 'עומר', neighborhood: 'דרום', edu: 'תואר שני בחינוך מיוחד', status: 'active', permitValid: true, expiry: '2029-03-01' },
    { first: 'נועה', last: 'בר', email: 'noa.bar@demo.il', phone: '054-1000005', id: '567890123', city: 'באר שבע', neighborhood: 'צפון', edu: 'גננת', status: 'active', permitValid: true, expiry: '2027-09-30' },
    { first: 'אורית', last: 'דוד', email: 'orit.david@demo.il', phone: '054-1000006', id: '678901234', city: 'עומר', neighborhood: 'דרום', edu: 'עוזרת גננת', status: 'pending_approval', permitValid: false, expiry: null },
    { first: 'יעל', last: 'ברק', email: 'yael.barak@demo.il', phone: '054-1000007', id: '789012345', city: 'באר שבע', neighborhood: 'צפון', edu: 'תואר ראשון בחינוך', status: 'active', permitValid: true, expiry: '2026-08-15' },
    { first: 'חנה', last: 'מזרחי', email: 'hana.mizrahi@demo.il', phone: '054-1000008', id: '890123456', city: 'עומר', neighborhood: 'דרום', edu: 'מטפלת ילדים', status: 'active', permitValid: true, expiry: '2027-04-20' },
    { first: 'ליאת', last: 'פרידמן', email: 'liat.friedman@demo.il', phone: '054-1000009', id: '901234567', city: 'באר שבע', neighborhood: 'צפון', edu: 'גננת', status: 'inactive', permitValid: false, expiry: null },
    { first: 'גלית', last: 'שגיא', email: 'galit.sagi@demo.il', phone: '054-1000010', id: '012345678', city: 'עומר', neighborhood: 'דרום', edu: 'תואר ראשון בחינוך', status: 'pending_approval', permitValid: false, expiry: null },
  ];

  const subIds: string[] = [];
  for (const s of substituteDefs) {
    const existingUser = await query(`SELECT id FROM users WHERE email = $1`, [s.email]);
    let userId: string;
    if (existingUser.rows.length === 0) {
      const uRes = await query(`
        INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
        VALUES ($1, $2, $3, 'substitute', $4, $5, $6) RETURNING id
      `, [authorityId, s.email, hash, s.first, s.last, s.phone]);
      userId = uRes.rows[0].id;
    } else {
      userId = existingUser.rows[0].id;
    }

    const existingSub = await query(`SELECT id FROM substitutes WHERE user_id = $1`, [userId]);
    let subId: string;
    if (existingSub.rows.length === 0) {
      const sRes = await query(`
        INSERT INTO substitutes
          (user_id, authority_id, id_number, address, neighborhood, education_level,
           work_permit_valid, work_permit_expiry, status, total_assignments, rating)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
      `, [
        userId, authorityId, s.id,
        `רחוב הרצל 1, ${s.city}`, s.neighborhood,
        s.edu, s.permitValid, s.expiry,
        s.status, Math.floor(Math.random() * 30), (3.5 + Math.random() * 1.5).toFixed(2),
      ]);
      subId = sRes.rows[0].id;
    } else {
      subId = existingSub.rows[0].id;
    }
    subIds.push(subId);
  }
  console.log(`  ✓ 10 Substitutes created`);

  // ──────────────────────────────────────────────
  // ABSENCE REPORTS (mix of past/today/future statuses)
  // Designed so the dashboard always has visible holes to demonstrate
  // the assignment flow + ML recommendations.
  // ──────────────────────────────────────────────
  const today = new Date();
  const d = (n: number) => { const x = new Date(today); x.setDate(x.getDate() + n); return x.toISOString().split('T')[0]; };
  // Skip Saturdays — no assignments on Shabbat in Israeli kindergartens.
  const isSaturday = (n: number) => { const x = new Date(today); x.setDate(x.getDate() + n); return x.getDay() === 6; };
  const nextWeekday = (n: number) => { let i = n; while (isSaturday(i)) i++; return i; };

  const t0 = nextWeekday(0);  // today (or next Sunday if today is Sat)
  const t1 = nextWeekday(t0 + 1);
  const t2 = nextWeekday(t1 + 1);
  const t3 = nextWeekday(t2 + 1);
  const t4 = nextWeekday(t3 + 1);
  const t5 = nextWeekday(t4 + 1);
  const t6 = nextWeekday(t5 + 1);
  const t7 = nextWeekday(t6 + 1);

  const absenceDefs = [
    // ─── Past, all covered (gives the calendar healthy history) ───
    { kg: kgIds[0], name: 'יעל כהן', role: 'teacher', date: d(-10), reason: 'sick', status: 'covered', reporter: mgr1UserId },
    { kg: kgIds[1], name: 'חנה ברק', role: 'assistant', date: d(-8), reason: 'vacation', status: 'covered', reporter: mgr1UserId },
    { kg: kgIds[2], name: 'תמר שלום', role: 'teacher', date: d(-6), reason: 'emergency', status: 'covered', reporter: mgr1UserId },
    { kg: kgIds[3], name: 'רות יפה', role: 'teacher', date: d(-5), reason: 'sick', status: 'covered', reporter: mgr1UserId },
    { kg: kgIds[4], name: 'מרים אלון', role: 'assistant', date: d(-4), reason: 'sick', status: 'covered', reporter: mgr1UserId },
    { kg: kgIds[10], name: 'שושנה עוז', role: 'teacher', date: d(-7), reason: 'vacation', status: 'covered', reporter: mgr2UserId },
    { kg: kgIds[11], name: 'אסתר לפיד', role: 'teacher', date: d(-5), reason: 'sick', status: 'covered', reporter: mgr2UserId },
    { kg: kgIds[12], name: 'פנינה גל', role: 'assistant', date: d(-3), reason: 'sick', status: 'covered', reporter: mgr2UserId },

    // ─── TODAY: 8 holes + 1 already assigned for visual contrast ───
    { kg: kgIds[0], name: 'יעל כהן', role: 'teacher', date: d(t0), reason: 'sick', status: 'assigned', reporter: mgr1UserId },
    { kg: kgIds[1], name: 'חנה ברק', role: 'assistant', date: d(t0), reason: 'sick', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[2], name: 'תמר שלום', role: 'teacher', date: d(t0), reason: 'emergency', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[3], name: 'רות יפה', role: 'teacher', date: d(t0), reason: 'sick', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[5], name: 'רבקה שמש', role: 'teacher', date: d(t0), reason: 'vacation', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[10], name: 'שושנה עוז', role: 'teacher', date: d(t0), reason: 'sick', status: 'open', reporter: mgr2UserId },
    { kg: kgIds[11], name: 'אסתר לפיד', role: 'teacher', date: d(t0), reason: 'sick', status: 'open', reporter: mgr2UserId },
    { kg: kgIds[12], name: 'פנינה גל', role: 'assistant', date: d(t0), reason: 'emergency', status: 'open', reporter: mgr2UserId },
    { kg: kgIds[13], name: 'ורד פינקל', role: 'assistant', date: d(t0), reason: 'sick', status: 'open', reporter: mgr2UserId },

    // ─── TOMORROW (or next weekday): 5 open holes ───
    { kg: kgIds[1], name: 'חנה ברק', role: 'assistant', date: d(t1), reason: 'vacation', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[4], name: 'מרים אלון', role: 'assistant', date: d(t1), reason: 'sick', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[6], name: 'לאה נמר', role: 'teacher', date: d(t1), reason: 'sick', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[14], name: 'זיוה בן חיים', role: 'teacher', date: d(t1), reason: 'sick', status: 'open', reporter: mgr2UserId },
    { kg: kgIds[15], name: 'מלכה אשר', role: 'teacher', date: d(t1), reason: 'vacation', status: 'open', reporter: mgr2UserId },

    // ─── +2 days: 4 open ───
    { kg: kgIds[2], name: 'תמר שלום', role: 'teacher', date: d(t2), reason: 'sick', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[7], name: 'נחמה ציון', role: 'assistant', date: d(t2), reason: 'vacation', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[11], name: 'אסתר לפיד', role: 'teacher', date: d(t2), reason: 'known', status: 'open', reporter: mgr2UserId },
    { kg: kgIds[16], name: 'אורנה הראל', role: 'assistant', date: d(t2), reason: 'sick', status: 'open', reporter: mgr2UserId },

    // ─── +3 days: 3 open ───
    { kg: kgIds[5], name: 'רבקה שמש', role: 'teacher', date: d(t3), reason: 'vacation', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[8], name: 'שמרית פלד', role: 'teacher', date: d(t3), reason: 'sick', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[13], name: 'ורד פינקל', role: 'assistant', date: d(t3), reason: 'vacation', status: 'open', reporter: mgr2UserId },

    // ─── +4 days: 4 open ───
    { kg: kgIds[0], name: 'יעל כהן', role: 'teacher', date: d(t4), reason: 'sick', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[9], name: 'תהילה רוט', role: 'assistant', date: d(t4), reason: 'sick', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[14], name: 'זיוה בן חיים', role: 'teacher', date: d(t4), reason: 'emergency', status: 'open', reporter: mgr2UserId },
    { kg: kgIds[17], name: 'גל בלאו', role: 'teacher', date: d(t4), reason: 'sick', status: 'open', reporter: mgr2UserId },

    // ─── +5 days: 2 open ───
    { kg: kgIds[3], name: 'רות יפה', role: 'teacher', date: d(t5), reason: 'sick', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[18], name: 'ברוריה לב', role: 'assistant', date: d(t5), reason: 'vacation', status: 'open', reporter: mgr2UserId },

    // ─── +6 days: 3 open ───
    { kg: kgIds[6], name: 'לאה נמר', role: 'teacher', date: d(t6), reason: 'known', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[15], name: 'מלכה אשר', role: 'teacher', date: d(t6), reason: 'sick', status: 'open', reporter: mgr2UserId },
    { kg: kgIds[19], name: 'נילי עמית', role: 'assistant', date: d(t6), reason: 'sick', status: 'open', reporter: mgr2UserId },

    // ─── +7 days: 2 open ───
    { kg: kgIds[7], name: 'נחמה ציון', role: 'assistant', date: d(t7), reason: 'vacation', status: 'open', reporter: mgr1UserId },
    { kg: kgIds[12], name: 'פנינה גל', role: 'assistant', date: d(t7), reason: 'sick', status: 'open', reporter: mgr2UserId },
  ];

  const absenceIds: string[] = [];
  for (const a of absenceDefs) {
    const existing = await query(
      `SELECT id FROM absence_reports WHERE kindergarten_id = $1 AND absent_employee_name = $2 AND absence_date = $3`,
      [a.kg, a.name, a.date]
    );
    if (existing.rows.length > 0) {
      absenceIds.push(existing.rows[0].id);
      continue;
    }
    const r = await query(`
      INSERT INTO absence_reports
        (kindergarten_id, reported_by, absent_employee_name, absent_employee_role,
         absence_date, absence_reason, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [a.kg, a.reporter, a.name, a.role, a.date, a.reason, a.status]);
    absenceIds.push(r.rows[0].id);
  }
  console.log(`  ✓ ${absenceDefs.length} Absence reports created`);

  // ──────────────────────────────────────────────
  // ASSIGNMENTS (for covered absences)
  // ──────────────────────────────────────────────
  const assignmentDefs = [
    // Past completed
    { absIdx: 0, subIdx: 0, kgIdx: 0, date: d(-10), status: 'completed', hrs: 6.5, rate: 45, reporter: mgr1UserId },
    { absIdx: 1, subIdx: 1, kgIdx: 1, date: d(-8), status: 'completed', hrs: 5.5, rate: 45, reporter: mgr1UserId },
    { absIdx: 2, subIdx: 2, kgIdx: 2, date: d(-6), status: 'completed', hrs: 6, rate: 45, reporter: mgr1UserId },
    { absIdx: 3, subIdx: 3, kgIdx: 3, date: d(-5), status: 'completed', hrs: 6.5, rate: 45, reporter: mgr1UserId },
    { absIdx: 4, subIdx: 4, kgIdx: 4, date: d(-4), status: 'completed', hrs: 6, rate: 45, reporter: mgr1UserId },
    { absIdx: 5, subIdx: 1, kgIdx: 10, date: d(-7), status: 'completed', hrs: 6, rate: 45, reporter: mgr2UserId },
    { absIdx: 6, subIdx: 2, kgIdx: 11, date: d(-5), status: 'completed', hrs: 6.5, rate: 45, reporter: mgr2UserId },
    { absIdx: 7, subIdx: 0, kgIdx: 12, date: d(-3), status: 'completed', hrs: 5.5, rate: 45, reporter: mgr2UserId },
    // Today - arrived/confirmed (matches the "assigned" absence at absIdx 8)
    { absIdx: 8, subIdx: 0, kgIdx: 0, date: d(t0), status: 'arrived', hrs: null, rate: 45, reporter: mgr1UserId },
  ];

  for (const a of assignmentDefs) {
    const existing = await query(
      `SELECT id FROM assignments WHERE absence_id = $1`,
      [absenceIds[a.absIdx]]
    );
    if (existing.rows.length > 0) continue;

    await query(`
      INSERT INTO assignments
        (absence_id, substitute_id, kindergarten_id, assigned_by, assignment_date,
         start_time, end_time, status, hours_worked, hourly_rate, total_pay,
         substitute_confirmed_at, substitute_arrived_at)
      VALUES ($1,$2,$3,$4,$5,'07:30','14:00',$6::varchar,$7,$8,$9,NOW(),
        CASE WHEN $6::varchar IN ('arrived','completed') THEN NOW() ELSE NULL END)
    `, [
      absenceIds[a.absIdx],
      subIds[a.subIdx],
      kgIds[a.kgIdx],
      a.reporter,
      a.date,
      a.status,
      a.hrs,
      a.rate,
      a.hrs && a.rate ? a.hrs * a.rate : null,
    ]);
  }
  console.log(`  ✓ ${assignmentDefs.length} Assignments created`);

  // ──────────────────────────────────────────────
  // KNOWN ABSENCES (planned leaves)
  // ──────────────────────────────────────────────
  const knownAbsenceDefs = [
    { kg: kgIds[0], name: 'יעל כהן', role: 'teacher', start: d(14), end: d(21), reason: 'vacation', creator: mgr1UserId },
    { kg: kgIds[5], name: 'רבקה שמש', role: 'teacher', start: d(20), end: d(27), reason: 'maternity', creator: mgr1UserId },
    { kg: kgIds[10], name: 'שושנה עוז', role: 'teacher', start: d(10), end: d(15), reason: 'sabbatical', creator: mgr2UserId },
    { kg: kgIds[15], name: 'מלכה אשר', role: 'teacher', start: d(30), end: d(37), reason: 'vacation', creator: mgr2UserId },
  ];

  for (const ka of knownAbsenceDefs) {
    const existing = await query(
      `SELECT id FROM known_absences WHERE kindergarten_id = $1 AND employee_name = $2 AND start_date = $3`,
      [ka.kg, ka.name, ka.start]
    );
    if (existing.rows.length === 0) {
      await query(`
        INSERT INTO known_absences (kindergarten_id, employee_name, employee_role, start_date, end_date, reason, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [ka.kg, ka.name, ka.role, ka.start, ka.end, ka.reason, ka.creator]);
    }
  }
  console.log(`  ✓ ${knownAbsenceDefs.length} Known absences created`);

  // ──────────────────────────────────────────────
  // SUBSTITUTE AVAILABILITY (some unavailable dates)
  // ──────────────────────────────────────────────
  await query(`
    INSERT INTO substitute_availability (substitute_id, date, is_available, reason)
    VALUES
      ($1, $2, false, 'vacation'),
      ($1, $3, false, 'vacation'),
      ($4, $5, false, 'sick'),
      ($4, $6, false, 'personal')
    ON CONFLICT (substitute_id, date) DO NOTHING
  `, [subIds[0], d(2), d(3), subIds[1], d(1), d(4)]);
  console.log(`  ✓ Substitute availability records created`);

  // ──────────────────────────────────────────────
  // NOTIFICATIONS
  // ──────────────────────────────────────────────
  const notifDefs = [
    { userId: adminId, type: 'account_approved', title: 'ברוך הבא', msg: 'הגדרות מערכת הושלמו בהצלחה.' },
    { userId: mgr1UserId, type: 'assignment_request', title: 'שיבוץ חדש נוצר', msg: `שרה כהן שובצה לגן חבצלת היום.` },
    { userId: mgr2UserId, type: 'assignment_request', title: 'שיבוץ אושר', msg: `מירה לוי אישרה את השיבוץ לגן ורד.` },
    { userId: subIds[0] ? adminId : adminId, type: 'permit_expiring', title: 'תיק עובד פג תוקף בקרוב', msg: 'לרינה אבן תיק עובד שפג תוקפו ב-31/12/2026.' },
  ];

  // Get user_id for substitutes to notify
  const sub0User = await query(`SELECT user_id FROM substitutes WHERE id = $1`, [subIds[0]]);
  if (sub0User.rows.length > 0) {
    await query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, 'assignment_request', 'שיבוץ חדש', 'שובצת לגן חבצלת היום. אנא אשרי את ההגעה.', '{"date":"${d(0)}"}')
      ON CONFLICT DO NOTHING
    `, [sub0User.rows[0].user_id]);
    await query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, 'account_approved', 'החשבון אושר', 'ברוכה הבאה! החשבון שלך אושר על ידי הרשות.', '{}')
      ON CONFLICT DO NOTHING
    `, [sub0User.rows[0].user_id]);
  }

  for (const n of notifDefs) {
    await query(`
      INSERT INTO notifications (user_id, type, title, message)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [n.userId, n.type, n.title, n.msg]);
  }
  console.log(`  ✓ Notifications created`);

  // ──────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────
  console.log('\n✅  Full seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Demo Accounts (password: Demo1234!)');
  console.log('  ─────────────────────────────────────');
  console.log(`  Admin:      ${adminEmail}`);
  console.log(`  Manager 1:  ${mgr1Email}  (10 KGs, North Zone)`);
  console.log(`  Manager 2:  ${mgr2Email}  (10 KGs, South Zone)`);
  console.log('  Substitutes:');
  for (const s of substituteDefs) {
    console.log(`    ${s.email}  [${s.status}]`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

export { main as seedFull };

if (require.main === module) {
  main()
    .then(() => pool.end())
    .catch(err => { console.error(err); process.exit(1); });
}
