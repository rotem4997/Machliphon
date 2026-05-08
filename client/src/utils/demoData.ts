/**
 * Centralized demo/placeholder data shown when the API is unreachable.
 * Used in queryFn error-fallbacks when the auth token is a demo-token.
 * All dates are generated relative to "today" so the demo always looks current.
 */

import { format, addDays, subDays } from 'date-fns';

const today = new Date();
const d = (offset: number) => format(addDays(today, offset), 'yyyy-MM-dd');
const past = (offset: number) => format(subDays(today, offset), 'yyyy-MM-dd');

// ─── Kindergartens ───────────────────────────────────────────
export const DEMO_KINDERGARTENS = [
  { id: 'kg-1', name: 'גן חבצלת',  address: 'רחוב הרצל 15',      neighborhood: 'מרכז',  age_group: 'גן ילדים',  principal_name: 'דנה שרון', phone: '04-9580100', capacity: 30, is_active: true },
  { id: 'kg-2', name: 'גן נרקיס',  address: 'רחוב ויצמן 8',       neighborhood: 'צפון',  age_group: 'גן ילדים',  principal_name: 'יעל רז',  phone: '04-9580101', capacity: 28, is_active: true },
  { id: 'kg-3', name: 'גן רקפת',   address: 'שדרות בן גוריון 22', neighborhood: 'דרום',  age_group: 'טרום חובה', principal_name: 'רות כהן', phone: '04-9580102', capacity: 25, is_active: true },
  { id: 'kg-4', name: 'גן כלנית',  address: 'רחוב סוקולוב 3',     neighborhood: 'מרכז',  age_group: 'גן ילדים',  principal_name: 'מיכל לוי', phone: '04-9580103', capacity: 32, is_active: true },
  { id: 'kg-5', name: 'גן דליה',   address: 'רחוב ז׳בוטינסקי 11', neighborhood: 'מזרח',  age_group: 'טרום חובה', principal_name: 'שרה גל',  phone: '04-9580104', capacity: 27, is_active: true },
];

// ─── Substitutes ─────────────────────────────────────────────
export const DEMO_SUBSTITUTES = [
  { id: 'sub-1', first_name: 'מרים',  last_name: 'אברהם',  phone: '054-1234567', status: 'active', work_permit_expiry: '2027-06-01', work_permit_valid: true, total_assignments: 24 },
  { id: 'sub-2', first_name: 'רחל',   last_name: 'לוי',    phone: '052-9876543', status: 'active', work_permit_expiry: '2026-08-15', work_permit_valid: true, total_assignments: 18 },
  { id: 'sub-3', first_name: 'שרה',   last_name: 'כהן',    phone: '050-5551234', status: 'active', work_permit_expiry: '2027-01-20', work_permit_valid: true, total_assignments: 31 },
];

// ─── Absence reports ─────────────────────────────────────────
export const DEMO_ABSENCES = [
  // Today — one open, one assigned
  {
    id: 'abs-1', kindergarten_id: 'kg-1', kindergarten_name: 'גן חבצלת',
    kindergarten_address: 'רחוב הרצל 15', absent_employee_name: 'יעל כהן',
    absent_employee_role: 'teacher', absence_date: d(0), absence_reason: 'sick',
    status: 'open', notes: null, created_at: new Date().toISOString(),
  },
  {
    id: 'abs-2', kindergarten_id: 'kg-3', kindergarten_name: 'גן רקפת',
    kindergarten_address: 'שדרות בן גוריון 22', absent_employee_name: 'חנה ברק',
    absent_employee_role: 'assistant', absence_date: d(0), absence_reason: 'vacation',
    status: 'assigned', notes: null, created_at: new Date().toISOString(),
  },
  // Tomorrow — open
  {
    id: 'abs-3', kindergarten_id: 'kg-2', kindergarten_name: 'גן נרקיס',
    kindergarten_address: 'רחוב ויצמן 8', absent_employee_name: 'תמר שלום',
    absent_employee_role: 'teacher', absence_date: d(1), absence_reason: 'known',
    status: 'open', notes: 'אירוע משפחתי', created_at: new Date().toISOString(),
  },
  // Day after tomorrow — open
  {
    id: 'abs-4', kindergarten_id: 'kg-4', kindergarten_name: 'גן כלנית',
    kindergarten_address: 'רחוב סוקולוב 3', absent_employee_name: 'אילנה דוד',
    absent_employee_role: 'teacher', absence_date: d(2), absence_reason: 'sick',
    status: 'open', notes: null, created_at: new Date().toISOString(),
  },
  // Past — covered
  {
    id: 'abs-5', kindergarten_id: 'kg-1', kindergarten_name: 'גן חבצלת',
    kindergarten_address: 'רחוב הרצל 15', absent_employee_name: 'יעל כהן',
    absent_employee_role: 'teacher', absence_date: past(3), absence_reason: 'sick',
    status: 'covered', notes: null, created_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
  },
  {
    id: 'abs-6', kindergarten_id: 'kg-5', kindergarten_name: 'גן דליה',
    kindergarten_address: 'רחוב ז׳בוטינסקי 11', absent_employee_name: 'נועה פרידמן',
    absent_employee_role: 'teacher', absence_date: past(5), absence_reason: 'vacation',
    status: 'uncovered', notes: null, created_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
  },
];

// ─── Assignments ─────────────────────────────────────────────
export const DEMO_ASSIGNMENTS = [
  // Today — confirmed (linked to abs-2)
  {
    id: 'asgn-1', absence_id: 'abs-2', assignment_date: d(0),
    start_time: '07:30', end_time: '14:00', status: 'confirmed',
    kindergarten_id: 'kg-3', kindergarten_name: 'גן רקפת',
    kindergarten_address: 'שדרות בן גוריון 22', neighborhood: 'דרום',
    substitute_first_name: 'מרים', substitute_last_name: 'אברהם', substitute_phone: '054-1234567',
    notes: null,
  },
  // Past — completed
  {
    id: 'asgn-2', absence_id: 'abs-5', assignment_date: past(3),
    start_time: '07:30', end_time: '14:00', status: 'completed',
    kindergarten_id: 'kg-1', kindergarten_name: 'גן חבצלת',
    kindergarten_address: 'רחוב הרצל 15', neighborhood: 'מרכז',
    substitute_first_name: 'רחל', substitute_last_name: 'לוי', substitute_phone: '052-9876543',
    notes: null, hours_worked: 6.5, total_pay: 357,
  },
  {
    id: 'asgn-3', absence_id: null, assignment_date: past(7),
    start_time: '08:00', end_time: '13:30', status: 'completed',
    kindergarten_id: 'kg-2', kindergarten_name: 'גן נרקיס',
    kindergarten_address: 'רחוב ויצמן 8', neighborhood: 'צפון',
    substitute_first_name: 'שרה', substitute_last_name: 'כהן', substitute_phone: '050-5551234',
    notes: null, hours_worked: 5.5, total_pay: 302,
  },
  // Future — pending (for substitute view)
  {
    id: 'asgn-4', absence_id: 'abs-4', assignment_date: d(2),
    start_time: '07:30', end_time: '14:00', status: 'pending',
    kindergarten_id: 'kg-4', kindergarten_name: 'גן כלנית',
    kindergarten_address: 'רחוב סוקולוב 3', neighborhood: 'מרכז',
    substitute_first_name: 'מרים', substitute_last_name: 'אברהם', substitute_phone: '054-1234567',
    notes: null,
  },
  {
    id: 'asgn-5', absence_id: null, assignment_date: d(5),
    start_time: '07:30', end_time: '14:00', status: 'pending',
    kindergarten_id: 'kg-1', kindergarten_name: 'גן חבצלת',
    kindergarten_address: 'רחוב הרצל 15', neighborhood: 'מרכז',
    substitute_first_name: 'מרים', substitute_last_name: 'אברהם', substitute_phone: '054-1234567',
    notes: null,
  },
];

// ─── Dashboard stats ──────────────────────────────────────────
export const DEMO_DASHBOARD_STATS = {
  totalSubstitutes: 3,
  todayCovered: 1,
  todayTotal: 2,
  openAbsences: 1,
  expiringPermits: 0,
  weekCoverage: Array.from({ length: 6 }, (_, i) => ({
    date: d(i),
    assignments: [1, 2, 0, 1, 0, 2][i],
    open_absences: [1, 1, 2, 0, 1, 0][i],
  })),
};

// ─── Activity feed ────────────────────────────────────────────
export const DEMO_ACTIVITY_FEED = [
  {
    event_type: 'assignment', id: 'ev-1', status: 'confirmed',
    event_time: new Date(Date.now() - 10 * 60_000).toISOString(),
    details: { kindergarten: 'גן רקפת', substitute: 'מרים אברהם', date: d(0) },
  },
  {
    event_type: 'absence', id: 'ev-2', status: 'open',
    event_time: new Date(Date.now() - 35 * 60_000).toISOString(),
    details: { kindergarten: 'גן חבצלת', employee: 'יעל כהן', date: d(0), reason: 'sick' },
  },
  {
    event_type: 'assignment', id: 'ev-3', status: 'completed',
    event_time: new Date(Date.now() - 3 * 3600_000).toISOString(),
    details: { kindergarten: 'גן חבצלת', substitute: 'רחל לוי', date: past(3) },
  },
  {
    event_type: 'absence', id: 'ev-4', status: 'assigned',
    event_time: new Date(Date.now() - 4 * 3600_000).toISOString(),
    details: { kindergarten: 'גן נרקיס', employee: 'תמר שלום', date: d(1), reason: 'known' },
  },
];

export const DEMO_LIVE_STATS = {
  assignmentsToday: { confirmed: 1, completed: 0 },
  absencesToday: { open: 1, assigned: 1 },
  availableSubstitutes: 2,
  lastActivity: new Date(Date.now() - 10 * 60_000).toISOString(),
};

// ─── Neighborhood coverage ────────────────────────────────────
export const DEMO_NEIGHBORHOODS = [
  { neighborhood: 'מרכז', coverage_pct: 90, total_assignments: 12, uncovered_absences: 1, kindergartens_count: 2 },
  { neighborhood: 'צפון', coverage_pct: 83, total_assignments: 8,  uncovered_absences: 1, kindergartens_count: 1 },
  { neighborhood: 'דרום', coverage_pct: 75, total_assignments: 6,  uncovered_absences: 2, kindergartens_count: 1 },
  { neighborhood: 'מזרח', coverage_pct: 67, total_assignments: 4,  uncovered_absences: 2, kindergartens_count: 1 },
];

// ─── Substitute profile ───────────────────────────────────────
export const DEMO_SUB_PROFILE = {
  id: 'sub-1',
  first_name: 'מרים',
  last_name: 'אברהם',
  email: 'miriam@example.com',
  phone: '054-1234567',
  photo_url: '',
  work_permit_valid: true,
  work_permit_expiry: '2027-06-01',
  total_assignments: 24,
};

// ─── Substitute availability (unavailable dates) ──────────────
export const DEMO_AVAILABILITY: { date: string; is_available: boolean }[] = [
  { date: d(3), is_available: false },
  { date: d(8), is_available: false },
];

// ─── Substitutes paginated (for SubstitutesPage) ──────────────
export const DEMO_SUBSTITUTES_PAGINATED = {
  data: [
    {
      id: 'sub-1', first_name: 'מרים', last_name: 'אברהם', phone: '054-1234567',
      email: 'miriam@example.com', id_number: '123456789', address: 'רחוב הרצל 5, יקנעם',
      neighborhood: 'מרכז', education_level: 'תואר ראשון', teaching_license_url: null,
      years_experience: 5, work_permit_valid: true, work_permit_expiry: '2027-06-01',
      work_permit_number: 'WP-2024-001', status: 'active', total_assignments: 24,
      rating: 4.8, has_assignment_today: true, assignments_this_month: 8,
    },
    {
      id: 'sub-2', first_name: 'רחל', last_name: 'לוי', phone: '052-9876543',
      email: 'rachel@example.com', id_number: '234567891', address: 'שדרות ויצמן 12, יקנעם',
      neighborhood: 'צפון', education_level: 'תואר שני', teaching_license_url: null,
      years_experience: 8, work_permit_valid: true, work_permit_expiry: '2026-08-15',
      work_permit_number: 'WP-2024-002', status: 'active', total_assignments: 18,
      rating: 4.5, has_assignment_today: false, assignments_this_month: 5,
    },
    {
      id: 'sub-3', first_name: 'שרה', last_name: 'כהן', phone: '050-5551234',
      email: 'sarah@example.com', id_number: '345678912', address: 'רחוב סוקולוב 8, יקנעם',
      neighborhood: 'דרום', education_level: 'תעודת הוראה', teaching_license_url: null,
      years_experience: 3, work_permit_valid: true, work_permit_expiry: '2027-01-20',
      work_permit_number: 'WP-2024-003', status: 'active', total_assignments: 31,
      rating: 4.9, has_assignment_today: false, assignments_this_month: 12,
    },
    {
      id: 'sub-4', first_name: 'לאה', last_name: 'דוד', phone: '053-7778899',
      email: 'leah@example.com', id_number: '456789123', address: 'רחוב העצמאות 3, יקנעם',
      neighborhood: 'מזרח', education_level: 'תואר ראשון', teaching_license_url: null,
      years_experience: 2, work_permit_valid: false, work_permit_expiry: '2025-03-01',
      work_permit_number: 'WP-2023-004', status: 'inactive', total_assignments: 7,
      rating: 4.1, has_assignment_today: false, assignments_this_month: 0,
    },
    {
      id: 'sub-5', first_name: 'נועה', last_name: 'פרידמן', phone: '054-6661234',
      email: 'noa@example.com', id_number: '567891234', address: 'שדרות רוטשילד 21, יקנעם',
      neighborhood: 'מרכז', education_level: 'תואר ראשון', teaching_license_url: null,
      years_experience: 1, work_permit_valid: true, work_permit_expiry: '2028-01-01',
      work_permit_number: null, status: 'pending_approval', total_assignments: 0,
      rating: 0, has_assignment_today: false, assignments_this_month: 0,
    },
  ],
  total: 5,
  page: 1,
  limit: 20,
  totalPages: 1,
};

// ─── Known absences (for KnownAbsencesPage) ──────────────────
export const DEMO_KNOWN_ABSENCES = [
  {
    id: 'ka-1', kindergarten_id: 'kg-1', kindergarten_name: 'גן חבצלת',
    employee_name: 'יעל כהן', reason: 'training', start_date: d(7), end_date: d(7),
    notes: 'השתלמות גננות', created_at: new Date().toISOString(),
  },
  {
    id: 'ka-2', kindergarten_id: 'kg-2', kindergarten_name: 'גן נרקיס',
    employee_name: 'תמר שלום', reason: 'vacation', start_date: d(14), end_date: d(16),
    notes: 'חופשה שנתית', created_at: new Date().toISOString(),
  },
  {
    id: 'ka-3', kindergarten_id: 'kg-3', kindergarten_name: 'גן רקפת',
    employee_name: 'חנה ברק', reason: 'medical', start_date: d(3), end_date: d(5),
    notes: 'ניתוח מתוכנן', created_at: new Date().toISOString(),
  },
];
