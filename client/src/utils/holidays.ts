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
  // פסח - Passover (15 Nisan 5786 = 2 April 2026; school break from Erev Passover)
  { name: 'פסח', start: '2026-04-01', end: '2026-04-10' },
  // יום הזיכרון - Memorial Day (4 Iyar 5786)
  { name: 'יום הזיכרון', start: '2026-04-21', end: '2026-04-21' },
  // יום העצמאות - Independence Day (5 Iyar 5786)
  { name: 'יום העצמאות', start: '2026-04-22', end: '2026-04-22' },
  // ל"ג בעומר - Lag BaOmer (18 Iyar 5786 = 5 May 2026)
  { name: 'ל"ג בעומר', start: '2026-05-05', end: '2026-05-05' },
  // שבועות - Shavuot (6 Sivan 5786 = 22 May 2026)
  { name: 'שבועות', start: '2026-05-22', end: '2026-05-23' },
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
