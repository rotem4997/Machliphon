import { query } from './pool';
import pool from './pool';

/**
 * Seed rich demo data for showcase: absences, assignments, notifications
 */
async function seedDemo() {
  console.log('🎨 Seeding showcase data...');

  // Get existing IDs
  const authority = await query(`SELECT id FROM authorities LIMIT 1`);
  const authorityId = authority.rows[0].id;

  const kindergartens = await query(`SELECT id, name FROM kindergartens WHERE authority_id = $1 ORDER BY name`, [authorityId]);
  const [kg1, kg2, kg3] = kindergartens.rows;

  const subs = await query(`SELECT s.id, u.first_name FROM substitutes s JOIN users u ON s.user_id = u.id WHERE s.authority_id = $1 ORDER BY u.first_name`, [authorityId]);
  const [sub1, sub2, sub3] = subs.rows;

  const adminUser = await query(`SELECT id FROM users WHERE role = 'authority_admin' AND authority_id = $1 LIMIT 1`, [authorityId]);
  const adminId = adminUser.rows[0].id;

  const managerUser = await query(`SELECT id FROM users WHERE role = 'manager' AND authority_id = $1 LIMIT 1`, [authorityId]);
  const managerId = managerUser.rows[0].id;

  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  // --- Absence reports (past, today, upcoming) ---
  const absences: { kg: string; name: string; role: string; date: string; reason: string; status: string; reporter: string }[] = [
    // Past - covered
    { kg: kg1.id, name: 'יעל כהן', role: 'teacher', date: formatDate(addDays(today, -7)), reason: 'sick', status: 'covered', reporter: managerId },
    { kg: kg2.id, name: 'חנה ברק', role: 'assistant', date: formatDate(addDays(today, -6)), reason: 'vacation', status: 'covered', reporter: managerId },
    { kg: kg1.id, name: 'יעל כהן', role: 'teacher', date: formatDate(addDays(today, -5)), reason: 'sick', status: 'covered', reporter: managerId },
    { kg: kg3.id, name: 'תמר שלום', role: 'teacher', date: formatDate(addDays(today, -3)), reason: 'emergency', status: 'covered', reporter: adminId },
    { kg: kg2.id, name: 'חנה ברק', role: 'assistant', date: formatDate(addDays(today, -2)), reason: 'sick', status: 'covered', reporter: managerId },
    // Today
    { kg: kg1.id, name: 'יעל כהן', role: 'teacher', date: formatDate(today), reason: 'sick', status: 'assigned', reporter: managerId },
    { kg: kg3.id, name: 'תמר שלום', role: 'teacher', date: formatDate(today), reason: 'vacation', status: 'open', reporter: adminId },
    // Upcoming
    { kg: kg2.id, name: 'חנה ברק', role: 'assistant', date: formatDate(addDays(today, 1)), reason: 'vacation', status: 'open', reporter: managerId },
    { kg: kg1.id, name: 'אילנה דוד', role: 'assistant', date: formatDate(addDays(today, 2)), reason: 'known', status: 'open', reporter: adminId },
    { kg: kg3.id, name: 'תמר שלום', role: 'teacher', date: formatDate(addDays(today, 3)), reason: 'sick', status: 'open', reporter: managerId },
  ];

  const absenceIds: string[] = [];
  for (const a of absences) {
    const r = await query(`
      INSERT INTO absence_reports (kindergarten_id, reported_by, absent_employee_name, absent_employee_role, absence_date, absence_reason, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [a.kg, a.reporter, a.name, a.role, a.date, a.reason, a.status]);
    absenceIds.push(r.rows[0].id);
  }

  // --- Assignments (linked to covered/assigned absences) ---
  // Past completed assignments
  await query(`
    INSERT INTO assignments (absence_id, substitute_id, kindergarten_id, assigned_by, assignment_date, status, hours_worked, hourly_rate, total_pay, substitute_confirmed_at, substitute_arrived_at)
    VALUES
    ($1, $2, $3, $4, $5, 'completed', 6.5, 55.00, 357.50, NOW() - interval '7 days', NOW() - interval '7 days'),
    ($6, $7, $8, $9, $10, 'completed', 6.5, 50.00, 325.00, NOW() - interval '6 days', NOW() - interval '6 days'),
    ($11, $12, $13, $14, $15, 'completed', 6.5, 55.00, 357.50, NOW() - interval '5 days', NOW() - interval '5 days'),
    ($16, $17, $18, $19, $20, 'completed', 6.5, 55.00, 357.50, NOW() - interval '3 days', NOW() - interval '3 days'),
    ($21, $22, $23, $24, $25, 'completed', 6.5, 50.00, 325.00, NOW() - interval '2 days', NOW() - interval '2 days')
  `, [
    absenceIds[0], sub1.id, kg1.id, adminId, formatDate(addDays(today, -7)),
    absenceIds[1], sub2.id, kg2.id, managerId, formatDate(addDays(today, -6)),
    absenceIds[2], sub1.id, kg1.id, adminId, formatDate(addDays(today, -5)),
    absenceIds[3], sub2.id, kg3.id, adminId, formatDate(addDays(today, -3)),
    absenceIds[4], sub2.id, kg2.id, managerId, formatDate(addDays(today, -2)),
  ]);

  // Today's assignment (confirmed)
  await query(`
    INSERT INTO assignments (absence_id, substitute_id, kindergarten_id, assigned_by, assignment_date, status, substitute_confirmed_at)
    VALUES ($1, $2, $3, $4, $5, 'confirmed', NOW())
  `, [absenceIds[5], sub1.id, kg1.id, adminId, formatDate(today)]);

  // Update substitute stats
  await query(`UPDATE substitutes SET total_assignments = 3, rating = 4.80 WHERE id = $1`, [sub1.id]);
  await query(`UPDATE substitutes SET total_assignments = 3, rating = 4.50 WHERE id = $1`, [sub2.id]);

  // --- Notifications ---
  const sub1User = await query(`SELECT user_id FROM substitutes WHERE id = $1`, [sub1.id]);
  const sub2User = await query(`SELECT user_id FROM substitutes WHERE id = $1`, [sub2.id]);

  await query(`
    INSERT INTO notifications (user_id, type, title, message) VALUES
    ($1, 'assignment_request', 'שיבוץ חדש', 'שובצת לגן הפרחים מחר. אנא אשרי.'),
    ($2, 'assignment_confirmed', 'אישור שיבוץ', 'המחליפה מרים אישרה את השיבוץ לגן הפרחים.'),
    ($3, 'permit_expiring', 'תיק עובד', 'תוקף תיק העובד של רות שמעון פג בעוד 4 חודשים.'),
    ($4, 'assignment_request', 'שיבוץ חדש', 'שובצת לגן הכוכבים ביום שלישי. אנא אשרי.')
  `, [sub1User.rows[0].user_id, adminId, adminId, sub2User.rows[0].user_id]);

  console.log('✅ Showcase data seeded!');
  console.log(`   ${absences.length} absence reports`);
  console.log('   6 assignments (5 completed + 1 confirmed)');
  console.log('   4 notifications');

  await pool.end();
}

seedDemo().catch(console.error);
