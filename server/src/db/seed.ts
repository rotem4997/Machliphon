import bcrypt from 'bcryptjs';
import { query } from './pool';
import pool from './pool';

interface SubSeed {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  idNumber: string;
  birthDate: string;
  neighborhood: string;
  educationLevel: string;
  yearsExperience: number;
  permitValid: boolean;
  permitExpiryYearOffset: number; // years from now
  status: 'active' | 'pending_approval';
}

const SUBS: SubSeed[] = [
  { email: 'miriam@example.com',  firstName: 'מרים',   lastName: 'אברהם',   phone: '050-3333301', idNumber: '100000019', birthDate: '1975-03-15', neighborhood: 'מרכז', educationLevel: 'teacher',   yearsExperience: 8, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'ruth@example.com',    firstName: 'רחל',    lastName: 'לוי',     phone: '050-3333302', idNumber: '100000027', birthDate: '1968-07-22', neighborhood: 'צפון',  educationLevel: 'teacher',   yearsExperience: 5, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'sarah@example.com',   firstName: 'שרה',    lastName: 'כהן',     phone: '050-3333303', idNumber: '100000035', birthDate: '1980-11-10', neighborhood: 'דרום',  educationLevel: 'assistant', yearsExperience: 3, permitValid: false, permitExpiryYearOffset: 0, status: 'pending_approval' },
  { email: 'leah@example.com',    firstName: 'לאה',    lastName: 'דוד',     phone: '050-3333304', idNumber: '100000043', birthDate: '1982-05-18', neighborhood: 'מזרח', educationLevel: 'teacher',   yearsExperience: 4, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'dina@example.com',    firstName: 'דינה',   lastName: 'שפירא',   phone: '050-3333305', idNumber: '100000050', birthDate: '1971-09-04', neighborhood: 'מרכז', educationLevel: 'teacher',   yearsExperience: 6, permitValid: true,  permitExpiryYearOffset: 2, status: 'active' },
  { email: 'hana@example.com',    firstName: 'חנה',    lastName: 'גלברג',   phone: '050-3333306', idNumber: '100000068', birthDate: '1990-02-12', neighborhood: 'צפון',  educationLevel: 'assistant', yearsExperience: 1, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'naomi@example.com',   firstName: 'נעמי',   lastName: 'ברנר',    phone: '050-3333307', idNumber: '100000076', birthDate: '1965-12-01', neighborhood: 'דרום',  educationLevel: 'teacher',   yearsExperience: 7, permitValid: true,  permitExpiryYearOffset: 2, status: 'active' },
  { email: 'rivka@example.com',   firstName: 'רבקה',   lastName: 'פרידמן',  phone: '050-3333308', idNumber: '100000084', birthDate: '1985-04-20', neighborhood: 'מזרח', educationLevel: 'assistant', yearsExperience: 3, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'esther@example.com',  firstName: 'אסתר',   lastName: 'מזרחי',   phone: '050-3333309', idNumber: '100000092', birthDate: '1978-08-30', neighborhood: 'מרכז', educationLevel: 'teacher',   yearsExperience: 5, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'yaffa@example.com',   firstName: 'יפה',    lastName: 'אזולאי',  phone: '050-3333310', idNumber: '100000100', birthDate: '1992-06-14', neighborhood: 'צפון',  educationLevel: 'assistant', yearsExperience: 2, permitValid: false, permitExpiryYearOffset: 0, status: 'pending_approval' },
  { email: 'michal@example.com',  firstName: 'מיכל',   lastName: 'ביטון',   phone: '050-3333311', idNumber: '100000118', birthDate: '1970-10-25', neighborhood: 'דרום',  educationLevel: 'teacher',   yearsExperience: 8, permitValid: true,  permitExpiryYearOffset: 2, status: 'active' },
  { email: 'tamar@example.com',   firstName: 'תמר',    lastName: 'חדד',     phone: '050-3333312', idNumber: '100000126', birthDate: '1983-01-07', neighborhood: 'מזרח', educationLevel: 'teacher',   yearsExperience: 4, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'ilana@example.com',   firstName: 'אילנה',  lastName: 'פרץ',     phone: '050-3333313', idNumber: '100000134', birthDate: '1972-11-19', neighborhood: 'מרכז', educationLevel: 'assistant', yearsExperience: 6, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'devora@example.com',  firstName: 'דבורה',  lastName: 'כץ',      phone: '050-3333314', idNumber: '100000142', birthDate: '1988-03-28', neighborhood: 'צפון',  educationLevel: 'teacher',   yearsExperience: 3, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'adina@example.com',   firstName: 'עדינה',  lastName: 'שמש',     phone: '050-3333315', idNumber: '100000159', birthDate: '1962-07-09', neighborhood: 'דרום',  educationLevel: 'teacher',   yearsExperience: 9, permitValid: true,  permitExpiryYearOffset: 2, status: 'active' },
  { email: 'margalit@example.com',firstName: 'מרגלית', lastName: 'בוקר',    phone: '050-3333316', idNumber: '100000167', birthDate: '1995-05-02', neighborhood: 'מזרח', educationLevel: 'assistant', yearsExperience: 1, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'rina@example.com',    firstName: 'רינה',   lastName: 'קורן',    phone: '050-3333317', idNumber: '100000175', birthDate: '1979-09-23', neighborhood: 'מרכז', educationLevel: 'teacher',   yearsExperience: 5, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'geula@example.com',   firstName: 'גאולה',  lastName: 'ממן',     phone: '050-3333318', idNumber: '100000183', birthDate: '1981-12-11', neighborhood: 'צפון',  educationLevel: 'assistant', yearsExperience: 4, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
  { email: 'aviva@example.com',   firstName: 'אביבה',  lastName: 'גל',      phone: '050-3333319', idNumber: '100000191', birthDate: '1973-06-06', neighborhood: 'דרום',  educationLevel: 'teacher',   yearsExperience: 7, permitValid: true,  permitExpiryYearOffset: 2, status: 'active' },
  { email: 'ziva@example.com',    firstName: 'זיוה',   lastName: 'שלום',    phone: '050-3333320', idNumber: '100000209', birthDate: '1991-08-17', neighborhood: 'מזרח', educationLevel: 'teacher',   yearsExperience: 2, permitValid: true,  permitExpiryYearOffset: 1, status: 'active' },
];

interface ManagerSeed {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  employeeId: string;
  region: string;
  kgIndices: number[]; // 0-based indices into the kgs array
}

const MANAGERS: ManagerSeed[] = [
  { email: 'manager@yokneam.muni.il',  firstName: 'רחל',    lastName: 'לוי',  phone: '050-2222201', employeeId: 'EMP001', region: 'מרכז וצפון', kgIndices: [0, 1] },
  { email: 'manager2@yokneam.muni.il', firstName: 'שלומית', lastName: 'גרוס', phone: '050-2222202', employeeId: 'EMP002', region: 'דרום ומזרח', kgIndices: [2, 3, 4] },
];

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

  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  // 2. Super admin (1)
  await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [authorityId, 'admin@machliphon.co.il', passwordHash, 'super_admin', 'מנהל', 'מערכת', '050-0000000']);

  // 3. Authority admin (kept for app navigation)
  const authAdminResult = await query(`
    INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [authorityId, 'director@yokneam.muni.il', passwordHash, 'authority_admin', 'דנה', 'כהן', '050-1111111']);
  void authAdminResult;

  // 4. Kindergartens (5)
  const kgs = await Promise.all([
    ['גן הפרחים',  'רחוב הורד 5',     'מרכז', 'נעמי גולד',   '04-9888200', '3-6', 35],
    ['גן הכוכבים', 'רחוב הנרקיס 12',  'צפון', 'אורית רוזן',  '04-9888201', '0-3', 25],
    ['גן הירח',    'רחוב הגפן 8',     'דרום', 'מיכל אהרון',  '04-9888202', '3-6', 30],
    ['גן השמש',    'רחוב הזית 3',     'מזרח','חיה לוין',     '04-9888203', '3-6', 28],
    ['גן הים',     'רחוב הצדף 10',    'דרום', 'שרי עזרא',    '04-9888204', '0-3', 22],
  ].map(async ([name, address, neighborhood, principal, phone, age, capacity]) => {
    const r = await query(`
      INSERT INTO kindergartens (authority_id, name, address, neighborhood, principal_name, phone, age_group, capacity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [authorityId, name, address, neighborhood, principal, phone, age, capacity]);
    return r.rows[0].id as string;
  }));

  // 5. Managers (2) — each with their kindergartens
  for (const m of MANAGERS) {
    const userResult = await query(`
      INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [authorityId, m.email, passwordHash, 'manager', m.firstName, m.lastName, m.phone]);
    const userId = userResult.rows[0].id;

    const mgrResult = await query(`
      INSERT INTO managers (user_id, authority_id, employee_id, region)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [userId, authorityId, m.employeeId, m.region]);
    const managerId = mgrResult.rows[0].id;

    for (const kgIdx of m.kgIndices) {
      await query(`
        INSERT INTO manager_kindergartens (manager_id, kindergarten_id) VALUES ($1, $2)
      `, [managerId, kgs[kgIdx]]);
    }
  }

  // 6. Substitutes (20)
  const nowYear = new Date().getFullYear();
  for (const s of SUBS) {
    const userResult = await query(`
      INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [authorityId, s.email, passwordHash, 'substitute', s.firstName, s.lastName, s.phone]);
    const userId = userResult.rows[0].id;

    const expiry = s.permitValid ? `${nowYear + s.permitExpiryYearOffset}-12-31` : null;
    await query(`
      INSERT INTO substitutes
        (user_id, authority_id, id_number, birth_date, neighborhood, work_permit_valid, work_permit_expiry, education_level, years_experience, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      userId, authorityId, s.idNumber, s.birthDate, s.neighborhood,
      s.permitValid, expiry, s.educationLevel, s.yearsExperience, s.status,
    ]);
  }

  console.log('✅ Seed data created successfully!');
  console.log('\n📋 Test accounts (password: Demo1234!):');
  console.log('  Super Admin:        admin@machliphon.co.il');
  console.log('  Authority Admin:    director@yokneam.muni.il');
  MANAGERS.forEach(m => console.log(`  Manager:            ${m.email}`));
  console.log(`  Substitutes:        ${SUBS.length} accounts (e.g. miriam@example.com, ruth@example.com, ...)`);

  await pool.end();
}

seed().catch(console.error);
