import { format, addDays } from 'date-fns';
import { isHoliday } from './holidays';

export interface MockSub {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  neighborhood: string;
  education_level: string;
  years_experience: number;
  total_assignments: number;
}

export interface MockKindergarten {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  age_group: string;
}

export interface MockAssignment {
  id: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  kindergarten_id: string;
  kindergarten_name: string;
  kindergarten_address: string;
  neighborhood: string;
  substitute_first_name: string;
  substitute_last_name: string;
  substitute_phone: string;
  notes: null;
}

export interface MockManager {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  region: string;
  managed_kindergartens_count: number;
}

// ─── Kindergartens ──────────────────────────────────────────
export const MOCK_KINDERGARTENS: MockKindergarten[] = [
  { id: 'kg-1', name: 'גן חבצלת',  address: 'רחוב הרצל 15',        neighborhood: 'מרכז', age_group: 'גן ילדים'   },
  { id: 'kg-2', name: 'גן נרקיס',  address: 'רחוב ויצמן 8',         neighborhood: 'צפון',  age_group: 'גן ילדים'   },
  { id: 'kg-3', name: 'גן רקפת',   address: 'שדרות בן גוריון 22',   neighborhood: 'דרום',  age_group: 'טרום חובה'  },
  { id: 'kg-4', name: 'גן כלנית',  address: 'רחוב סוקולוב 3',       neighborhood: 'מרכז', age_group: 'גן ילדים'   },
  { id: 'kg-5', name: 'גן דליה',   address: 'רחוב ז׳בוטינסקי 11',   neighborhood: 'מזרח', age_group: 'טרום חובה'  },
];

// ─── 20 Substitutes ─────────────────────────────────────────
export const MOCK_20_SUBS: MockSub[] = [
  { id: 'sub-1',  first_name: 'מרים',    last_name: 'אברהם',   phone: '054-1234567', neighborhood: 'מרכז', education_level: 'תואר ראשון',    years_experience: 3, total_assignments: 24 },
  { id: 'sub-2',  first_name: 'רחל',     last_name: 'לוי',     phone: '052-9876543', neighborhood: 'צפון',  education_level: 'תואר שני',       years_experience: 5, total_assignments: 42 },
  { id: 'sub-3',  first_name: 'שרה',     last_name: 'כהן',     phone: '050-5551234', neighborhood: 'דרום',  education_level: 'סמינר',          years_experience: 2, total_assignments: 15 },
  { id: 'sub-4',  first_name: 'לאה',     last_name: 'דוד',     phone: '053-7778899', neighborhood: 'מזרח', education_level: 'תואר ראשון',    years_experience: 4, total_assignments: 31 },
  { id: 'sub-5',  first_name: 'דינה',    last_name: 'שפירא',   phone: '054-2223344', neighborhood: 'מרכז', education_level: 'תעודת הוראה',   years_experience: 6, total_assignments: 55 },
  { id: 'sub-6',  first_name: 'חנה',     last_name: 'גלברג',   phone: '052-3334455', neighborhood: 'צפון',  education_level: 'תואר ראשון',    years_experience: 1, total_assignments: 8  },
  { id: 'sub-7',  first_name: 'נעמי',    last_name: 'ברנר',    phone: '050-4445566', neighborhood: 'דרום',  education_level: 'תואר שני',       years_experience: 7, total_assignments: 63 },
  { id: 'sub-8',  first_name: 'רבקה',    last_name: 'פרידמן',  phone: '053-5556677', neighborhood: 'מזרח', education_level: 'סמינר',          years_experience: 3, total_assignments: 19 },
  { id: 'sub-9',  first_name: 'אסתר',    last_name: 'מזרחי',   phone: '054-6667788', neighborhood: 'מרכז', education_level: 'תואר ראשון',    years_experience: 5, total_assignments: 37 },
  { id: 'sub-10', first_name: 'יפה',     last_name: 'אזולאי',  phone: '052-7778899', neighborhood: 'צפון',  education_level: 'תעודת הוראה',   years_experience: 2, total_assignments: 12 },
  { id: 'sub-11', first_name: 'מיכל',    last_name: 'ביטון',   phone: '050-8889900', neighborhood: 'דרום',  education_level: 'תואר שני',       years_experience: 8, total_assignments: 71 },
  { id: 'sub-12', first_name: 'תמר',     last_name: 'חדד',     phone: '053-9990011', neighborhood: 'מזרח', education_level: 'תואר ראשון',    years_experience: 4, total_assignments: 28 },
  { id: 'sub-13', first_name: 'אילנה',   last_name: 'פרץ',     phone: '054-0001122', neighborhood: 'מרכז', education_level: 'סמינר',          years_experience: 6, total_assignments: 47 },
  { id: 'sub-14', first_name: 'דבורה',   last_name: 'כץ',      phone: '052-1112233', neighborhood: 'צפון',  education_level: 'תואר ראשון',    years_experience: 3, total_assignments: 22 },
  { id: 'sub-15', first_name: 'עדינה',   last_name: 'שמש',     phone: '050-2223344', neighborhood: 'דרום',  education_level: 'תואר שני',       years_experience: 9, total_assignments: 84 },
  { id: 'sub-16', first_name: 'מרגלית',  last_name: 'בוקר',    phone: '053-3334455', neighborhood: 'מזרח', education_level: 'תעודת הוראה',   years_experience: 1, total_assignments: 6  },
  { id: 'sub-17', first_name: 'רינה',    last_name: 'קורן',    phone: '054-4445566', neighborhood: 'מרכז', education_level: 'תואר ראשון',    years_experience: 5, total_assignments: 39 },
  { id: 'sub-18', first_name: 'גאולה',   last_name: 'ממן',     phone: '052-5556677', neighborhood: 'צפון',  education_level: 'סמינר',          years_experience: 4, total_assignments: 33 },
  { id: 'sub-19', first_name: 'אביבה',   last_name: 'גל',      phone: '050-6667788', neighborhood: 'דרום',  education_level: 'תואר שני',       years_experience: 7, total_assignments: 58 },
  { id: 'sub-20', first_name: 'זיוה',    last_name: 'שלום',    phone: '053-7778800', neighborhood: 'מזרח', education_level: 'תואר ראשון',    years_experience: 2, total_assignments: 17 },
];

// ─── 2 Managers ─────────────────────────────────────────────
export const MOCK_MANAGERS: MockManager[] = [
  { id: 'mgr-1', first_name: 'רחל',    last_name: 'לוי',  email: 'manager@yokneam.muni.il',  region: 'מרכז וצפון', managed_kindergartens_count: 3 },
  { id: 'mgr-2', first_name: 'שלומית', last_name: 'גרוס', email: 'manager2@yokneam.muni.il', region: 'דרום ומזרח', managed_kindergartens_count: 2 },
];

// ─── 1 Super Admin ───────────────────────────────────────────
export const MOCK_SUPER_ADMIN = {
  id: 'sa-1',
  first_name: 'מנהל',
  last_name: 'מערכת',
  email: 'admin@machliphon.co.il',
  role: 'super_admin' as const,
};

// ─── Generate base assignments ───────────────────────────────
export function generateMockAssignments(): MockAssignment[] {
  const today = new Date();
  const assignments: MockAssignment[] = [];

  for (let dayOffset = -5; dayOffset <= 20; dayOffset++) {
    const date = addDays(today, dayOffset);
    if (date.getDay() === 6) continue;
    const dateStr = format(date, 'yyyy-MM-dd');
    if (isHoliday(dateStr)) continue;

    const usedSubIds = new Set<string>();
    const seed = Math.abs(dayOffset * 7 + 3);
    const pattern = seed % 5;
    const holeCount = pattern <= 1 ? 0 : pattern <= 3 ? 1 : 2;

    const holeIndices = new Set<number>();
    if (holeCount >= 1) holeIndices.add(seed % MOCK_KINDERGARTENS.length);
    if (holeCount >= 2) holeIndices.add((seed + 2) % MOCK_KINDERGARTENS.length);

    MOCK_KINDERGARTENS.forEach((kg, ki) => {
      if (holeIndices.has(ki)) return;
      const availSub = MOCK_20_SUBS.find(s => !usedSubIds.has(s.id)) || MOCK_20_SUBS[ki % MOCK_20_SUBS.length];
      usedSubIds.add(availSub.id);
      assignments.push({
        id: `mock-asgn-${dateStr}-${kg.id}`,
        assignment_date: dateStr,
        start_time: '07:30',
        end_time: '14:00',
        status: dayOffset < 0 ? 'completed' : dayOffset === 0 ? 'confirmed' : 'pending',
        kindergarten_id: kg.id,
        kindergarten_name: kg.name,
        kindergarten_address: kg.address,
        neighborhood: kg.neighborhood,
        substitute_first_name: availSub.first_name,
        substitute_last_name: availSub.last_name,
        substitute_phone: availSub.phone,
        notes: null,
      });
    });
  }
  return assignments;
}

export const MOCK_BASE_ASSIGNMENTS = generateMockAssignments();
