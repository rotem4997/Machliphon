import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth';
import substitutesRoutes from './routes/substitutes';
import assignmentsRoutes from './routes/assignments';
import dashboardRoutes from './routes/dashboard';
import absencesRoutes from './routes/absences';
import kindergartensRoutes from './routes/kindergartens';
import notificationsRoutes from './routes/notifications';
import activityRoutes from './routes/activity';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Validate required env vars ───────────────────────────────
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set, generating a random one (NOT suitable for production)');
  process.env.JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
}

// ── Request tracking ─────────────────────────────────────────
app.use(requestIdMiddleware);

// ── Security middleware ──────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL || true
    : true,
  credentials: true,
}));

// ── Rate limiting ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
  message: 'יותר מדי בקשות. נסה שנית בעוד מעט.',
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'יותר מדי ניסיונות כניסה. נסה שנית בעוד 15 דקות.',
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ──────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Health check ─────────────────────────────────────────────
app.get('/health', async (_, res) => {
  const { query: dbQuery } = await import('./db/pool');
  let dbStatus = 'unknown';
  try {
    await dbQuery('SELECT 1');
    dbStatus = 'connected';
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    db: dbStatus,
    hasDbUrl: !!process.env.DATABASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
  });
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/substitutes', substitutesRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/absences', absencesRoutes);
app.use('/api/kindergartens', kindergartensRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/activity', activityRoutes);

// ── Serve frontend in production ─────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // ── 404 handler (dev only — frontend served by Vite) ────────
  app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
  });
}

// ── Error handler ────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
import { runMigrations } from './db/migrate';

async function start() {
  console.log('🔧 Startup diagnostics:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
  console.log(`   JWT_SECRET set: ${!!process.env.JWT_SECRET}`);
  console.log(`   PORT: ${PORT}`);

  try {
    await runMigrations();
  } catch (err) {
    console.error('Migration failed, starting server anyway:', err);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Machliphon server running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
  });
}

start();

export default app;
