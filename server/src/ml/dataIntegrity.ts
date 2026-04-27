// Data-integrity checks. Run before training, after every ML write, and on
// demand via /api/ml/integrity-report or the test agent.
//
// Each check is read-only and authority-scoped. The checks enforce invariants
// that the schema can't express in CHECK constraints (cross-table consistency).

import { query } from '../db/pool';

export interface IntegrityFinding {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;             // Hebrew, user-facing
  detail: string;              // English, debug context
  count: number;
  sampleIds?: string[];
}

export interface IntegrityReport {
  authorityId: string;
  generatedAt: string;
  ok: boolean;
  findings: IntegrityFinding[];
}

async function checkOrphanedAssignments(authorityId: string): Promise<IntegrityFinding | null> {
  const r = await query(
    `SELECT a.id FROM assignments a
       LEFT JOIN substitutes s ON s.id = a.substitute_id
       LEFT JOIN kindergartens k ON k.id = a.kindergarten_id
      WHERE k.authority_id = $1
        AND (s.id IS NULL OR k.id IS NULL)
      LIMIT 5`,
    [authorityId],
  );
  if (r.rows.length === 0) return null;
  return {
    severity: 'error',
    code: 'ORPHANED_ASSIGNMENT',
    message: 'נמצאו שיבוצים ללא מחליפה או גן תקפים.',
    detail: 'Assignments reference missing substitute_id or kindergarten_id',
    count: r.rows.length,
    sampleIds: r.rows.map(x => x.id),
  };
}

async function checkDoubleBookings(authorityId: string): Promise<IntegrityFinding | null> {
  const r = await query(
    `SELECT a.substitute_id, a.assignment_date, COUNT(*) AS n
       FROM assignments a
       JOIN kindergartens k ON k.id = a.kindergarten_id
      WHERE k.authority_id = $1
        AND a.status NOT IN ('cancelled')
      GROUP BY a.substitute_id, a.assignment_date
      HAVING COUNT(*) > 1
      LIMIT 5`,
    [authorityId],
  );
  if (r.rows.length === 0) return null;
  return {
    severity: 'error',
    code: 'DOUBLE_BOOKING',
    message: 'נמצאו מחליפות עם שיבוץ כפול באותו תאריך.',
    detail: 'Substitute has more than one non-cancelled assignment on the same date',
    count: r.rows.length,
    sampleIds: r.rows.map(x => `${x.substitute_id}@${x.assignment_date}`),
  };
}

async function checkRatingOutOfRange(authorityId: string): Promise<IntegrityFinding | null> {
  const r = await query(
    `SELECT a.id FROM assignments a
       JOIN kindergartens k ON k.id = a.kindergarten_id
      WHERE k.authority_id = $1
        AND a.rating IS NOT NULL
        AND (a.rating < 1 OR a.rating > 5)
      LIMIT 5`,
    [authorityId],
  );
  if (r.rows.length === 0) return null;
  return {
    severity: 'error',
    code: 'RATING_OUT_OF_RANGE',
    message: 'נמצאו דירוגים מחוץ לטווח 1–5.',
    detail: 'assignments.rating outside [1,5]',
    count: r.rows.length,
    sampleIds: r.rows.map(x => x.id),
  };
}

async function checkCompletedWithoutHours(authorityId: string): Promise<IntegrityFinding | null> {
  const r = await query(
    `SELECT a.id FROM assignments a
       JOIN kindergartens k ON k.id = a.kindergarten_id
      WHERE k.authority_id = $1
        AND a.status = 'completed'
        AND (a.hours_worked IS NULL OR a.hours_worked <= 0)
      LIMIT 5`,
    [authorityId],
  );
  if (r.rows.length === 0) return null;
  return {
    severity: 'warning',
    code: 'COMPLETED_NO_HOURS',
    message: 'שיבוצים שהושלמו ללא שעות עבודה.',
    detail: 'completed assignments with hours_worked NULL or <= 0',
    count: r.rows.length,
    sampleIds: r.rows.map(x => x.id),
  };
}

async function checkExpiredPermits(authorityId: string): Promise<IntegrityFinding | null> {
  const r = await query(
    `SELECT s.id FROM substitutes s
      WHERE s.authority_id = $1
        AND s.work_permit_valid = true
        AND s.work_permit_expiry IS NOT NULL
        AND s.work_permit_expiry < CURRENT_DATE
      LIMIT 10`,
    [authorityId],
  );
  if (r.rows.length === 0) return null;
  return {
    severity: 'warning',
    code: 'EXPIRED_PERMIT_FLAGGED_VALID',
    message: 'תיקי עובד שפג תוקפם עדיין מסומנים כתקפים.',
    detail: 'substitutes.work_permit_valid=true but work_permit_expiry in the past',
    count: r.rows.length,
    sampleIds: r.rows.map(x => x.id),
  };
}

async function checkAssignmentSubstituteAuthorityMismatch(authorityId: string): Promise<IntegrityFinding | null> {
  const r = await query(
    `SELECT a.id FROM assignments a
       JOIN substitutes s ON s.id = a.substitute_id
       JOIN kindergartens k ON k.id = a.kindergarten_id
      WHERE k.authority_id = $1
        AND s.authority_id <> k.authority_id
      LIMIT 5`,
    [authorityId],
  );
  if (r.rows.length === 0) return null;
  return {
    severity: 'error',
    code: 'AUTHORITY_MISMATCH',
    message: 'שיבוצים בהם המחליפה והגן שייכים לרשויות שונות.',
    detail: 'assignment substitute.authority_id != kindergarten.authority_id',
    count: r.rows.length,
    sampleIds: r.rows.map(x => x.id),
  };
}

async function checkNegativePay(authorityId: string): Promise<IntegrityFinding | null> {
  const r = await query(
    `SELECT a.id FROM assignments a
       JOIN kindergartens k ON k.id = a.kindergarten_id
      WHERE k.authority_id = $1
        AND (a.hours_worked < 0 OR a.hourly_rate < 0 OR a.total_pay < 0)
      LIMIT 5`,
    [authorityId],
  );
  if (r.rows.length === 0) return null;
  return {
    severity: 'error',
    code: 'NEGATIVE_PAY',
    message: 'נמצאו שעות/תעריף/תשלום שליליים.',
    detail: 'hours_worked, hourly_rate, or total_pay is negative',
    count: r.rows.length,
    sampleIds: r.rows.map(x => x.id),
  };
}

export async function runIntegrityChecks(authorityId: string): Promise<IntegrityReport> {
  const checks = await Promise.all([
    checkOrphanedAssignments(authorityId),
    checkDoubleBookings(authorityId),
    checkRatingOutOfRange(authorityId),
    checkCompletedWithoutHours(authorityId),
    checkExpiredPermits(authorityId),
    checkAssignmentSubstituteAuthorityMismatch(authorityId),
    checkNegativePay(authorityId),
  ]);
  const findings = checks.filter((f): f is IntegrityFinding => f !== null);
  const ok = !findings.some(f => f.severity === 'error');
  return {
    authorityId,
    generatedAt: new Date().toISOString(),
    ok,
    findings,
  };
}
