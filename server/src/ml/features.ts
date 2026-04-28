// Feature engineering for the three Machliphon ML models.
//
// Functions here are pure: they take plain rows from the DB and return
// numeric feature vectors. Routes/agents call them after pulling the data.

export interface SubstituteRow {
  id: string;
  authority_id: string;
  neighborhood: string | null;
  preferred_neighborhoods: string[] | null;
  available_days: string[] | null;
  max_distance_km: number | null;
  rating: number | null;
  total_assignments: number | null;
  years_experience: number | null;
  education_level: string | null;
  work_permit_valid: boolean;
  status: string;
}

export interface KindergartenRow {
  id: string;
  neighborhood: string | null;
  age_group: string | null;
}

export interface AssignmentRow {
  id: string;
  substitute_id: string;
  kindergarten_id: string;
  assignment_date: string;             // ISO date
  status: string;                       // 'pending'|'confirmed'|'arrived'|'completed'|'cancelled'|'no_show'
  rating: number | null;
  cancellation_reason: string | null;
  hours_worked: number | null;
  created_at: string;                   // ISO timestamp
}

// Day-of-week encoded as int (Sunday=0 like Israeli week).
export function dayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.getUTCDay();
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function isAvailableOnDay(sub: SubstituteRow, dateStr: string): number {
  if (!sub.available_days || sub.available_days.length === 0) return 1;
  return sub.available_days.includes(DAY_NAMES[dayOfWeek(dateStr)]) ? 1 : 0;
}

export function neighborhoodMatch(sub: SubstituteRow, kg: KindergartenRow): number {
  if (!kg.neighborhood) return 0;
  if (sub.neighborhood === kg.neighborhood) return 1;
  if (sub.preferred_neighborhoods?.includes(kg.neighborhood)) return 1;
  return 0;
}

// === Match-model features ===
// Used to rank substitutes for a (kindergarten, date) request.
// Label = "successful" assignment (status in {confirmed, arrived, completed} & rating>=3 if rated).
export const MATCH_FEATURE_NAMES = [
  'rating',
  'years_experience',
  'total_assignments_log',
  'work_permit_valid',
  'available_on_day',
  'neighborhood_match',
  'has_priored_neighborhood',
  'is_active',
];

export function matchFeatures(sub: SubstituteRow, kg: KindergartenRow, dateStr: string): number[] {
  return [
    sub.rating ?? 0,
    sub.years_experience ?? 0,
    Math.log1p(sub.total_assignments ?? 0),
    sub.work_permit_valid ? 1 : 0,
    isAvailableOnDay(sub, dateStr),
    neighborhoodMatch(sub, kg),
    sub.preferred_neighborhoods && sub.preferred_neighborhoods.length > 0 ? 1 : 0,
    sub.status === 'active' ? 1 : 0,
  ];
}

export function matchLabel(a: AssignmentRow): 0 | 1 {
  if (a.status === 'completed' || a.status === 'arrived') {
    if (a.rating == null) return 1;
    return a.rating >= 3 ? 1 : 0;
  }
  if (a.status === 'confirmed') return 1;
  return 0;
}

// === No-show model features ===
// Used at assignment-creation time to flag risky pairings.
// Label = 1 if assignment ended in no_show or substitute-side cancellation.
export const NO_SHOW_FEATURE_NAMES = [
  'lead_hours',
  'sub_rating',
  'sub_total_assignments_log',
  'sub_years_experience',
  'is_neighborhood_match',
  'is_day_available',
  'sub_no_show_rate',
  'sub_cancellation_rate',
];

export interface SubstituteHistory {
  noShowCount: number;
  cancellationCount: number;
  totalCount: number;
}

export function summarizeSubstituteHistory(rows: AssignmentRow[]): SubstituteHistory {
  let noShow = 0;
  let cancel = 0;
  for (const r of rows) {
    if (r.status === 'no_show') noShow++;
    else if (r.status === 'cancelled' && r.cancellation_reason && /מחליפה|substitute/i.test(r.cancellation_reason)) {
      cancel++;
    }
  }
  return { noShowCount: noShow, cancellationCount: cancel, totalCount: rows.length };
}

export function noShowFeatures(
  sub: SubstituteRow,
  kg: KindergartenRow,
  dateStr: string,
  createdAt: Date,
  history: SubstituteHistory,
): number[] {
  const assignmentDate = new Date(dateStr + 'T07:30:00Z');
  const leadMs = assignmentDate.getTime() - createdAt.getTime();
  const leadHours = Math.max(0, leadMs / 3_600_000);
  const safeTotal = Math.max(history.totalCount, 1);
  return [
    leadHours,
    sub.rating ?? 0,
    Math.log1p(sub.total_assignments ?? 0),
    sub.years_experience ?? 0,
    neighborhoodMatch(sub, kg),
    isAvailableOnDay(sub, dateStr),
    history.noShowCount / safeTotal,
    history.cancellationCount / safeTotal,
  ];
}

export function noShowLabel(a: AssignmentRow): 0 | 1 {
  if (a.status === 'no_show') return 1;
  if (a.status === 'cancelled' && a.cancellation_reason && /מחליפה|substitute/i.test(a.cancellation_reason)) return 1;
  return 0;
}

// === Demand forecast ===
// Per-(kindergarten, day-of-week) Poisson-style baseline, blended with a
// recent-trend term. Simple, interpretable, no external dep.
export interface DemandSeries {
  kindergartenId: string;
  // counts[d] = absences on date d (ISO yyyy-mm-dd) over the training window
  counts: Map<string, number>;
}

export interface DemandModel {
  // Mean absences per day-of-week (0=Sun..6=Sat)
  perDow: number[];
  // Recent 7-day rolling mean
  recentMean: number;
  // Total samples used
  samples: number;
}

export function trainDemandModel(series: DemandSeries, today: Date): DemandModel {
  const perDow = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  let recentSum = 0;
  let recentDays = 0;
  const recentCutoff = new Date(today);
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - 7);

  for (const [date, n] of series.counts) {
    const d = new Date(date + 'T00:00:00Z');
    const dow = d.getUTCDay();
    perDow[dow] += n;
    counts[dow]++;
    if (d >= recentCutoff && d <= today) {
      recentSum += n;
      recentDays++;
    }
  }
  for (let i = 0; i < 7; i++) {
    perDow[i] = counts[i] > 0 ? perDow[i] / counts[i] : 0;
  }
  return {
    perDow,
    recentMean: recentDays > 0 ? recentSum / recentDays : 0,
    samples: series.counts.size,
  };
}

export function predictDemand(model: DemandModel, dateStr: string): number {
  const dow = dayOfWeek(dateStr);
  // Blend: 0.7 * dow seasonal + 0.3 * recent trend
  return 0.7 * model.perDow[dow] + 0.3 * model.recentMean;
}
