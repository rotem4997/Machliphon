import { useEffect, useState } from 'react';
import axios from 'axios';

const POLL_MS = 1500;

interface AgentStatus {
  status: 'idle' | 'working' | 'reviewing' | 'done' | 'error';
  task?: string;
  progress?: number;
  updatedAt?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'done' | 'failed';
  assignedTo?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface LogEntry {
  agent: string;
  event: string;
  task?: string;
  status?: string;
  title?: string;
  ts?: string;
}

const AGENT_ICONS: Record<string, string> = {
  'team-lead': '🎯', 'feature-planner': '📋', 'backend-developer': '⚙️',
  'react-specialist': '⚛️', 'sql-pro': '🗄️', 'api-designer': '🔌',
  'typescript-pro': '📘', 'security-engineer': '🔒', 'code-reviewer': '🔍',
  'deployment-engineer': '🚀', 'debugger': '🐛', 'qa-expert': '✅', 'system': '🤖',
};

const STATUS_COLORS: Record<string, string> = {
  idle: '#64748b', working: '#38bdf8', reviewing: '#fbbf24', done: '#4ade80', error: '#f87171',
};

const STATUS_BG: Record<string, string> = {
  idle: '#1e293b', working: '#0c2744', reviewing: '#2d1f00', done: '#052e16', error: '#2d0a0a',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: '#f87171', medium: '#fbbf24', low: '#4ade80',
};

function timeAgo(iso?: string) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

type TabStatus = 'pending' | 'in-progress' | 'done';

export default function AgentDashboard() {
  const [agentStatus, setAgentStatus] = useState<Record<string, AgentStatus>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<TabStatus>('pending');

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const [s, t, l] = await Promise.all([
          axios.get('/api/agent/status').then(r => r.data),
          axios.get('/api/agent/tasks').then(r => r.data),
          axios.get('/api/agent/log').then(r => r.data),
        ]);
        if (!cancelled) { setAgentStatus(s); setTasks(t); setLog(l); }
      } catch { /* server not ready */ }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const filteredTasks = tasks.filter(t => {
    if (tab === 'done') return t.status === 'done' || t.status === 'failed';
    return t.status === tab;
  });

  const workingCount = Object.values(agentStatus).filter(a => a.status === 'working' || a.status === 'reviewing').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', direction: 'ltr' }}>
      {/* Header */}
      <div style={{ background: '#111827', borderBottom: '1px solid #1e2d45', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Machliphon Agent Dashboard</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>מחליפון · Real-time Multi-Agent Monitor</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, background: '#4ade80', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.4s infinite' }} />
          <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>LIVE</span>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#111827', borderBottom: '1px solid #1e2d45', display: 'flex' }}>
        {[
          { label: 'Working', value: workingCount, color: '#38bdf8' },
          { label: 'Tasks Done', value: doneCount, color: '#4ade80' },
          { label: 'Queued', value: pendingCount, color: '#fbbf24' },
          { label: 'Agents', value: Object.keys(agentStatus).length, color: '#e2e8f0' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 28px', borderRight: '1px solid #1e2d45', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 300px', height: 'calc(100vh - 105px)' }}>

        {/* LEFT — Agents */}
        <div style={{ borderRight: '1px solid #1e2d45', padding: 16, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b', marginBottom: 14 }}>
            Agents <span style={{ background: '#1a2235', border: '1px solid #1e2d45', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{Object.keys(agentStatus).length}</span>
          </div>
          {Object.entries(agentStatus).map(([name, data]) => {
            const st = data.status || 'idle';
            return (
              <div key={name} style={{ background: '#111827', border: `1px solid ${st === 'working' ? '#38bdf8' : st === 'done' ? '#4ade80' : '#1e2d45'}`, borderRadius: 10, padding: '11px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLORS[st] || '#64748b', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{AGENT_ICONS[name] || '🤖'} {name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', padding: '2px 7px', borderRadius: 5, background: STATUS_BG[st] || '#1e293b', color: STATUS_COLORS[st] || '#64748b' }}>{st}</span>
                </div>
                <div style={{ fontSize: 11, color: st !== 'idle' ? '#e2e8f0' : '#64748b', marginTop: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.task || '—'}</div>
                {data.updatedAt && <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>{timeAgo(data.updatedAt)}</div>}
                {(st === 'working' || st === 'reviewing') && (
                  <div style={{ height: 3, background: '#1a2235', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${data.progress || 0}%`, background: 'linear-gradient(90deg,#0ea5e9,#6366f1)', borderRadius: 2, transition: 'width .5s' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CENTER — Tasks */}
        <div style={{ borderRight: '1px solid #1e2d45', padding: 16, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b', marginBottom: 14 }}>
            Task Queue <span style={{ background: '#1a2235', border: '1px solid #1e2d45', borderRadius: 10, padding: '1px 7px' }}>{tasks.length}</span>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#1a2235', padding: 3, borderRadius: 8, marginBottom: 14 }}>
            {(['pending', 'in-progress', 'done'] as TabStatus[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: 'none', background: tab === t ? '#111827' : 'transparent', color: tab === t ? '#e2e8f0' : '#64748b', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.4)' : 'none' }}>
                {t === 'in-progress' ? 'In Progress' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {filteredTasks.length === 0
            ? <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: '40px 0' }}>No {tab} tasks</div>
            : filteredTasks.map(task => (
              <div key={task.id} style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 8, padding: '11px 13px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_COLORS[task.priority] || '#4ade80', flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.4 }}>{task.title}</div>
                    {task.description && <div style={{ fontSize: 11, color: '#64748b', marginTop: 5, lineHeight: 1.5 }}>{task.description}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {task.assignedTo && (
                        <span style={{ fontSize: 10, background: '#0c2744', border: '1px solid #1e2d45', borderRadius: 5, padding: '1px 7px', color: '#38bdf8' }}>
                          {AGENT_ICONS[task.assignedTo] || '🤖'} {task.assignedTo}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: '#64748b' }}>{timeAgo(task.updatedAt || task.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* RIGHT — Activity Log */}
        <div style={{ padding: 16, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b', marginBottom: 14 }}>
            Activity Log <span style={{ background: '#1a2235', border: '1px solid #1e2d45', borderRadius: 10, padding: '1px 7px' }}>{log.length}</span>
          </div>
          {log.length === 0
            ? <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: '40px 0' }}>No activity yet</div>
            : log.slice(0, 60).map((entry, i) => {
              let msg = '';
              if (entry.event === 'status') msg = `→ ${entry.status || ''}${entry.task ? ': ' + entry.task : ''}`;
              else if (entry.event === 'task_added') msg = `New task: ${entry.title}`;
              else if (entry.event === 'task_done') msg = `Completed: ${entry.title}`;
              else if (entry.event === 'task_in-progress') msg = `Started: ${entry.title}`;
              else msg = entry.task || entry.title || entry.event;

              return (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid #1e2d45' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#0c2744', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                    {AGENT_ICONS[entry.agent] || '🤖'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>{entry.agent}</span>{' '}{msg}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                      {entry.ts ? new Date(entry.ts).toLocaleTimeString() : ''}
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.85)} }
        ::-webkit-scrollbar { width: 5px }
        ::-webkit-scrollbar-thumb { background: #1e2d45; border-radius: 3px }
      `}</style>
    </div>
  );
}
