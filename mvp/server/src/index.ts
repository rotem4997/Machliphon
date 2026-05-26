import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import absencesRouter from './routes/absences';
import assignmentsRouter from './routes/assignments';
import availabilityRouter from './routes/availability';

const app = express();

// Security headers
app.use(helmet());

// CORS — allow configured client origin
const allowedOrigin = process.env.CLIENT_URL ?? 'http://localhost:5173';
app.use(
  cors({
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Rate limiting: 100 requests per 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'יותר מדי בקשות, נסה שוב מאוחר יותר' },
  })
);

// Body parsing
app.use(express.json());

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Routes
app.use('/api/absences', absencesRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/availability', availabilityRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'המסלול לא נמצא' });
});

// Central error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Error) {
    console.error('[ERROR]', err.message, err.stack);
    const status =
      (err as Error & { status?: number; statusCode?: number }).status ??
      (err as Error & { status?: number; statusCode?: number }).statusCode ??
      500;
    const message = status < 500 ? err.message : 'שגיאת שרת פנימית';
    res.status(status).json({ error: message });
    return;
  }
  console.error('[ERROR] Unknown error', err);
  res.status(500).json({ error: 'שגיאת שרת פנימית' });
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on port ${PORT}`);
});

export default app;
