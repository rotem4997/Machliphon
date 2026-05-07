import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const DASH_DIR = path.resolve(__dirname, '../../../.claude/dashboard');
const STATUS_FILE = path.join(DASH_DIR, 'status.json');
const TASKS_FILE  = path.join(DASH_DIR, 'tasks.json');
const LOG_FILE    = path.join(DASH_DIR, 'activity.json');

function readJSON(file: string, fallback: unknown) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJSON(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function appendLog(entry: Record<string, unknown>) {
  const log = readJSON(LOG_FILE, []) as unknown[];
  (log as unknown[]).unshift({ ...entry, ts: new Date().toISOString() });
  if ((log as unknown[]).length > 200) (log as unknown[]).length = 200;
  writeJSON(LOG_FILE, log);
}

router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  res.json(readJSON(STATUS_FILE, {}));
}));

router.post('/status', asyncHandler(async (req: Request, res: Response) => {
  const update = req.body as Record<string, Record<string, unknown>>;
  const current = readJSON(STATUS_FILE, {}) as Record<string, unknown>;
  Object.entries(update).forEach(([agent, data]) => {
    current[agent] = { ...(current[agent] as object || {}), ...data, updatedAt: new Date().toISOString() };
    appendLog({ agent, event: 'status', ...data });
  });
  writeJSON(STATUS_FILE, current);
  res.json({ ok: true });
}));

router.get('/tasks', asyncHandler(async (_req: Request, res: Response) => {
  res.json(readJSON(TASKS_FILE, []));
}));

router.post('/tasks', asyncHandler(async (req: Request, res: Response) => {
  const task = req.body as Record<string, unknown>;
  const tasks = readJSON(TASKS_FILE, []) as unknown[];
  task.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  task.createdAt = new Date().toISOString();
  task.status = task.status || 'pending';
  tasks.push(task);
  writeJSON(TASKS_FILE, tasks);
  appendLog({ agent: 'system', event: 'task_added', title: task.title });
  res.status(201).json(task);
}));

router.patch('/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
  const update = req.body as Record<string, unknown>;
  const tasks = readJSON(TASKS_FILE, []) as Array<Record<string, unknown>>;
  const idx = tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: 'Task not found' }); return; }
  tasks[idx] = { ...tasks[idx], ...update, updatedAt: new Date().toISOString() };
  if (update.status === 'done') tasks[idx].completedAt = new Date().toISOString();
  writeJSON(TASKS_FILE, tasks);
  appendLog({ agent: update.assignedTo || 'system', event: `task_${update.status || 'updated'}`, title: tasks[idx].title });
  res.json(tasks[idx]);
}));

router.get('/log', asyncHandler(async (_req: Request, res: Response) => {
  res.json(readJSON(LOG_FILE, []));
}));

export default router;
