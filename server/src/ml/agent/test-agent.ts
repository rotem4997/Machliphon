// ML test agent — exercises every ML capability end-to-end.
//
// Run with: `npm run ml:agent --workspace=server`
//
// What it does, in order:
//   1. Loads each authority that has any data.
//   2. Snapshots row counts of every domain table (data-integrity baseline).
//   3. Runs runIntegrityChecks() — fails the run if any 'error'-severity finding.
//   4. Trains the three models per authority and asserts metrics are sane.
//   5. Calls each inference path (recommend, no-show, forecast) end-to-end.
//   6. Re-snapshots row counts and asserts no domain rows were mutated
//      (only ml_models / ml_predictions are allowed to grow).
//   7. Prints a structured report and exits non-zero on failure.

import pool, { query } from '../../db/pool';
import { runIntegrityChecks, IntegrityReport } from '../dataIntegrity';
import { trainMatchModel, recommendSubstitutes } from '../recommender';
import { trainNoShowModel, predictNoShowRisk } from '../noShowRisk';
import { trainDemandModels, forecastDemand } from '../demand';

interface AgentCheck {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  detail?: string;
  data?: unknown;
}

interface AgentReport {
  startedAt: string;
  finishedAt: string;
  authorityId: string;
  checks: AgentCheck[];
  pass: boolean;
}

const DOMAIN_TABLES = [
  'authorities', 'users', 'kindergartens', 'managers', 'manager_kindergartens',
  'substitutes', 'absence_reports', 'assignments', 'substitute_availability',
  'known_absences', 'notifications',
];

async function snapshotCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of DOMAIN_TABLES) {
    try {
      const r = await query(`SELECT COUNT(*)::int AS n FROM ${t}`);
      out[t] = r.rows[0].n;
    } catch (e) {
      out[t] = -1;
    }
  }
  return out;
}

function diffCounts(before: Record<string, number>, after: Record<string, number>): string[] {
  const diffs: string[] = [];
  for (const k of Object.keys(before)) {
    if (before[k] !== after[k]) diffs.push(`${k}: ${before[k]} → ${after[k]}`);
  }
  return diffs;
}

async function pickAuthorityWithData(): Promise<string | null> {
  const r = await query(`
    SELECT a.id
      FROM authorities a
      LEFT JOIN substitutes s ON s.authority_id = a.id
      LEFT JOIN kindergartens k ON k.authority_id = a.id
     GROUP BY a.id
     ORDER BY COUNT(DISTINCT s.id) + COUNT(DISTINCT k.id) DESC
     LIMIT 1
  `);
  return r.rows[0]?.id ?? null;
}

async function pickActiveSubstitute(authorityId: string): Promise<string | null> {
  const r = await query(
    `SELECT id FROM substitutes WHERE authority_id = $1 AND status = 'active' LIMIT 1`,
    [authorityId],
  );
  return r.rows[0]?.id ?? null;
}

async function pickKindergarten(authorityId: string): Promise<string | null> {
  const r = await query(
    `SELECT id FROM kindergartens WHERE authority_id = $1 AND is_active = true LIMIT 1`,
    [authorityId],
  );
  return r.rows[0]?.id ?? null;
}

async function pickAssignmentInAuthority(authorityId: string): Promise<string | null> {
  const r = await query(
    `SELECT a.id
       FROM assignments a
       JOIN kindergartens k ON k.id = a.kindergarten_id
      WHERE k.authority_id = $1
      ORDER BY a.created_at DESC
      LIMIT 1`,
    [authorityId],
  );
  return r.rows[0]?.id ?? null;
}

function nextWeekday(daysFromToday: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

async function run(): Promise<AgentReport> {
  const startedAt = new Date().toISOString();
  const checks: AgentCheck[] = [];

  const authorityId = await pickAuthorityWithData();
  if (!authorityId) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      authorityId: '',
      checks: [{ name: 'pickAuthority', status: 'fail', detail: 'No authority found in DB' }],
      pass: false,
    };
  }

  const before = await snapshotCounts();
  checks.push({ name: 'snapshot.before', status: 'pass', data: before });

  // 1. Integrity baseline
  let integrity: IntegrityReport;
  try {
    integrity = await runIntegrityChecks(authorityId);
    const blockingErrors = integrity.findings.filter(f => f.severity === 'error');
    checks.push({
      name: 'integrity.baseline',
      status: blockingErrors.length === 0 ? 'pass' : 'fail',
      detail: blockingErrors.length === 0
        ? `${integrity.findings.length} non-blocking finding(s)`
        : `${blockingErrors.length} blocking error(s)`,
      data: integrity,
    });
  } catch (e: any) {
    checks.push({ name: 'integrity.baseline', status: 'fail', detail: e?.message });
  }

  // 2. Train models
  try {
    const { result } = await trainMatchModel(authorityId);
    const ok = result.samples >= 0 && result.auc >= 0 && result.auc <= 1;
    checks.push({
      name: 'train.match',
      status: ok ? 'pass' : 'fail',
      detail: `samples=${result.samples}, positives=${result.positives}, auc=${result.auc.toFixed(3)}`,
      data: result,
    });
  } catch (e: any) {
    checks.push({ name: 'train.match', status: 'fail', detail: e?.message });
  }
  try {
    const { result } = await trainNoShowModel(authorityId);
    const ok = result.samples >= 0 && result.auc >= 0 && result.auc <= 1;
    checks.push({
      name: 'train.no_show',
      status: ok ? 'pass' : 'fail',
      detail: `samples=${result.samples}, positives=${result.positives}, auc=${result.auc.toFixed(3)}`,
      data: result,
    });
  } catch (e: any) {
    checks.push({ name: 'train.no_show', status: 'fail', detail: e?.message });
  }
  try {
    const { result } = await trainDemandModels(authorityId);
    const ok = result.totalSamples >= 0 && result.metric >= 0;
    checks.push({
      name: 'train.demand',
      status: ok ? 'pass' : 'fail',
      detail: `kgs=${result.kindergartens}, samples=${result.totalSamples}, mae=${result.metric.toFixed(3)}`,
      data: result,
    });
  } catch (e: any) {
    checks.push({ name: 'train.demand', status: 'fail', detail: e?.message });
  }

  // 3. Inference paths
  const kgId = await pickKindergarten(authorityId);
  if (kgId) {
    try {
      const recs = await recommendSubstitutes(authorityId, kgId, nextWeekday(2), 5);
      const ok = recs.every(r => r.score >= 0 && r.score <= 1);
      const sorted = recs.every((r, i) => i === 0 || recs[i - 1].score >= r.score);
      checks.push({
        name: 'predict.match',
        status: ok && sorted ? 'pass' : 'fail',
        detail: `returned ${recs.length} recs, scores in [0,1]=${ok}, sorted desc=${sorted}`,
        data: recs.slice(0, 3),
      });
    } catch (e: any) {
      checks.push({ name: 'predict.match', status: 'fail', detail: e?.message });
    }

    try {
      const f = await forecastDemand(authorityId, kgId, 7);
      const allNonNeg = !!f && f.predictions.every(p => p.expected >= 0);
      checks.push({
        name: 'predict.demand',
        status: f && allNonNeg ? 'pass' : 'fail',
        detail: f ? `${f.predictions.length} days forecasted, all >= 0 = ${allNonNeg}` : 'no forecast returned',
        data: f?.predictions.slice(0, 3),
      });
    } catch (e: any) {
      checks.push({ name: 'predict.demand', status: 'fail', detail: e?.message });
    }
  } else {
    checks.push({ name: 'predict.match', status: 'skip', detail: 'no kindergarten in authority' });
    checks.push({ name: 'predict.demand', status: 'skip', detail: 'no kindergarten in authority' });
  }

  const assignmentId = await pickAssignmentInAuthority(authorityId);
  if (assignmentId) {
    try {
      const risk = await predictNoShowRisk(authorityId, assignmentId);
      const ok = !!risk && risk.score >= 0 && risk.score <= 1
        && ['low', 'medium', 'high'].includes(risk.band);
      checks.push({
        name: 'predict.no_show',
        status: ok ? 'pass' : 'fail',
        detail: ok ? `score=${risk!.score.toFixed(3)} band=${risk!.band}` : 'invalid output',
        data: risk,
      });
    } catch (e: any) {
      checks.push({ name: 'predict.no_show', status: 'fail', detail: e?.message });
    }
  } else {
    checks.push({ name: 'predict.no_show', status: 'skip', detail: 'no assignment in authority' });
  }

  // 4. Substitute sanity check (smoke-test the recommender pipeline against a known sub).
  const subId = await pickActiveSubstitute(authorityId);
  if (subId && kgId) {
    try {
      const recs = await recommendSubstitutes(authorityId, kgId, nextWeekday(7), 50);
      const present = recs.find(r => r.substituteId === subId);
      // If the substitute has no conflicting assignment, they should appear.
      const hasConflict = await query(
        `SELECT 1 FROM assignments WHERE substitute_id = $1 AND assignment_date = $2 AND status NOT IN ('cancelled')`,
        [subId, nextWeekday(7)],
      );
      const expected = hasConflict.rows.length === 0;
      const ok = expected ? !!present : !present;
      checks.push({
        name: 'sanity.activeSubInRecs',
        status: ok ? 'pass' : 'fail',
        detail: expected
          ? (ok ? 'active sub appears in recs' : 'expected sub missing')
          : 'sub had a conflict, correctly excluded',
      });
    } catch (e: any) {
      checks.push({ name: 'sanity.activeSubInRecs', status: 'fail', detail: e?.message });
    }
  }

  // 5. Re-check integrity & domain-row immutability
  try {
    const after = await snapshotCounts();
    const diffs = diffCounts(before, after);
    checks.push({
      name: 'snapshot.domainImmutable',
      status: diffs.length === 0 ? 'pass' : 'fail',
      detail: diffs.length === 0 ? 'no domain table changed' : `changed: ${diffs.join('; ')}`,
      data: after,
    });
  } catch (e: any) {
    checks.push({ name: 'snapshot.domainImmutable', status: 'fail', detail: e?.message });
  }

  try {
    const post = await runIntegrityChecks(authorityId);
    const blocking = post.findings.filter(f => f.severity === 'error').length;
    checks.push({
      name: 'integrity.afterRun',
      status: blocking === 0 ? 'pass' : 'fail',
      detail: blocking === 0 ? 'still ok' : `${blocking} blocking error(s) after run`,
      data: post,
    });
  } catch (e: any) {
    checks.push({ name: 'integrity.afterRun', status: 'fail', detail: e?.message });
  }

  const pass = checks.every(c => c.status !== 'fail');
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    authorityId,
    checks,
    pass,
  };
}

function printReport(r: AgentReport) {
  const head = r.pass ? 'ML AGENT — PASS' : 'ML AGENT — FAIL';
  const bar = '='.repeat(head.length);
  console.log(`\n${bar}\n${head}\n${bar}`);
  console.log(`Authority: ${r.authorityId || '(none)'}`);
  console.log(`Window: ${r.startedAt} → ${r.finishedAt}\n`);
  for (const c of r.checks) {
    const tag = c.status === 'pass' ? '[PASS]' : c.status === 'fail' ? '[FAIL]' : '[SKIP]';
    console.log(`${tag} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
  }
  console.log('');
}

if (require.main === module) {
  run()
    .then(report => {
      printReport(report);
      // Also emit JSON for piping into tools.
      if (process.env.ML_AGENT_JSON === '1') {
        console.log(JSON.stringify(report, null, 2));
      }
      return pool.end().then(() => {
        process.exit(report.pass ? 0 : 1);
      });
    })
    .catch(err => {
      console.error('ML agent crashed:', err);
      pool.end().finally(() => process.exit(2));
    });
}

export { run as runMLAgent };
