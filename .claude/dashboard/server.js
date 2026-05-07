#!/usr/bin/env node
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const STATUS_FILE = path.join(DIR, 'status.json');
const TASKS_FILE  = path.join(DIR, 'tasks.json');
const LOG_FILE    = path.join(DIR, 'activity.json');
const PORT = 4040;

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function appendLog(entry) {
  const log = readJSON(LOG_FILE, []);
  log.unshift({ ...entry, ts: new Date().toISOString() });
  if (log.length > 200) log.length = 200;
  writeJSON(LOG_FILE, log);
}

function parseBody(req) {
  return new Promise((res, rej) => {
    let buf = '';
    req.on('data', c => buf += c);
    req.on('end', () => { try { res(JSON.parse(buf || '{}')); } catch(e) { rej(e); } });
    req.on('error', rej);
  });
}

const ROUTES = {
  'GET /': (req, res) => {
    const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  },
  'GET /api/status': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readJSON(STATUS_FILE, {})));
  },
  'POST /api/status': async (req, res) => {
    const update = await parseBody(req);
    const current = readJSON(STATUS_FILE, {});
    Object.entries(update).forEach(([agent, data]) => {
      current[agent] = { ...current[agent], ...data, updatedAt: new Date().toISOString() };
      appendLog({ agent, event: 'status', ...data });
    });
    writeJSON(STATUS_FILE, current);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  },
  'GET /api/tasks': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readJSON(TASKS_FILE, [])));
  },
  'POST /api/tasks': async (req, res) => {
    const task = await parseBody(req);
    const tasks = readJSON(TASKS_FILE, []);
    task.id = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    task.createdAt = new Date().toISOString();
    task.status = task.status || 'pending';
    tasks.push(task);
    writeJSON(TASKS_FILE, tasks);
    appendLog({ agent: 'system', event: 'task_added', title: task.title });
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(task));
  },
  'PATCH /api/tasks': async (req, res, taskId) => {
    const update = await parseBody(req);
    const tasks = readJSON(TASKS_FILE, []);
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) { res.writeHead(404); res.end('{}'); return; }
    tasks[idx] = { ...tasks[idx], ...update, updatedAt: new Date().toISOString() };
    if (update.status === 'done') tasks[idx].completedAt = new Date().toISOString();
    writeJSON(TASKS_FILE, tasks);
    appendLog({ agent: update.assignedTo || 'system', event: 'task_' + (update.status || 'updated'), title: tasks[idx].title });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tasks[idx]));
  },
  'GET /api/log': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readJSON(LOG_FILE, [])));
  },
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];
  // /api/tasks/:id
  if (req.method === 'PATCH' && url.startsWith('/api/tasks/')) {
    try { await ROUTES['PATCH /api/tasks'](req, res, url.split('/')[3]); }
    catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  const key = req.method + ' ' + url;
  const handler = ROUTES[key];
  if (handler) {
    try { await handler(req, res); }
    catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
  } else {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  Machliphon Agent Dashboard`);
  console.log(`   http://localhost:${PORT}\n`);
});
