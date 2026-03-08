// Israeli Education Ministry official holidays for school year 2025-2026
// Source: חוזר מנכ"ל משרד החינוך - לוח חופשות
// Each holiday has a name, start date (inclusive), and end date (inclusive)

export interface Holiday {
  name: string;
  start: string; // yyyy-MM-dd
  end: string;   // yyyy-MM-dd
}

// 2025-2026 school year holidays
export const HOLIDAYS_2025_2026: Holiday[] = [
  // ראש השנה - Rosh Hashana
  { name: 'ראש השנה', start: '2025-09-22', end: '2025-09-24' },
  // יום כיפור - Yom Kippur (eve + day)
  { name: 'יום כיפור', start: '2025-10-01', end: '2025-10-02' },
  // סוכות - Sukkot
  { name: 'סוכות', start: '2025-10-06', end: '2025-10-13' },
  // חנוכה - Hanukkah
  { name: 'חנוכה', start: '2025-12-14', end: '2025-12-22' },
  // ט"ו בשבט - Tu BiShvat
  { name: 'ט"ו בשבט', start: '2026-02-09', end: '2026-02-09' },
  // פורים - Purim
  { name: 'פורים', start: '2026-03-03', end: '2026-03-04' },
  // פסח - Passover
  { name: 'פסח', start: '2026-03-21', end: '2026-04-01' },
  // יום הזיכרון - Memorial Day
  { name: 'יום הזיכרון', start: '2026-04-21', end: '2026-04-21' },
  // יום העצמאות - Independence Day
  { name: 'יום העצמאות', start: '2026-04-22', end: '2026-04-22' },
  // ל"ג בעומר - Lag BaOmer
  { name: 'ל"ג בעומר', start: '2026-05-12', end: '2026-05-12' },
  // שבועות - Shavuot
  { name: 'שבועות', start: '2026-05-31', end: '2026-06-01' },
  // חופשת קיץ - Summer vacation
  { name: 'חופשת קיץ', start: '2026-06-21', end: '2026-08-31' },
];

// Helper: check if a date string falls on a holiday
export function isHoliday(dateStr: string): Holiday | null {
  for (const h of HOLIDAYS_2025_2026) {
    if (dateStr >= h.start && dateStr <= h.end) return h;
  }
  return null;
}

// Helper: get all holidays in a given month (year-month)
export function getHolidaysInMonth(year: number, month: number): Holiday[] {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  return HOLIDAYS_2025_2026.filter(h => {
    const hStartMonth = h.start.slice(0, 7);
    const hEndMonth = h.end.slice(0, 7);
    return hStartMonth <= monthStr && hEndMonth >= monthStr;
  });
}
