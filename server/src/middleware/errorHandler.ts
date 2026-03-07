import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorDebugInfo } from '../errors/AppError';

/**
 * Structured error response returned to clients.
 *
 * `error`      – Hebrew user-friendly message (safe to display in UI).
 * `errorCode`  – Machine-readable code for the frontend to branch on.
 * `requestId`  – Correlates with server logs for debugging.
 * `debug`      – Full technical details (only in non-production).
 */
interface ErrorResponse {
  error: string;
  errorCode: string;
  requestId?: string;
  timestamp: string;
  debug?: ErrorDebugInfo;
}

/**
 * Classify raw / unknown errors into a structured format for logging.
 */
function classifyError(err: Error, req: Request): { statusCode: number; userMessage: string; debugInfo: ErrorDebugInfo } {
  // Database connection errors
  if (err.message?.includes('ECONNREFUSED') || err.message?.includes('connection') && err.message?.includes('terminated')) {
    return {
      statusCode: 503,
      userMessage: 'המערכת אינה זמינה כרגע. אנא נסה שנית בעוד מספר דקות.',
      debugInfo: {
        code: 'DB_CONNECTION_LOST',
        source: `${req.method} ${req.path}`,
        detail: err.message,
        meta: { stack: err.stack },
      },
    };
  }

  // Pool exhaustion
  if (err.message?.includes('timeout') && err.message?.includes('pool')) {
    return {
      statusCode: 503,
      userMessage: 'המערכת עמוסה כרגע. אנא נסה שנית.',
      debugInfo: {
        code: 'DB_POOL_EXHAUSTED',
        source: `${req.method} ${req.path}`,
        detail: err.message,
        meta: { stack: err.stack },
      },
    };
  }

  // SQL syntax / query errors
  if ((err as any).code && /^[0-9]{5}$/.test((err as any).code)) {
    return {
      statusCode: 500,
      userMessage: 'שגיאה בעיבוד הבקשה. אנא נסה שנית.',
      debugInfo: {
        code: `PG_${(err as any).code}`,
        source: `${req.method} ${req.path}`,
        detail: err.message,
        meta: {
          pgCode: (err as any).code,
          table: (err as any).table,
          constraint: (err as any).constraint,
          column: (err as any).column,
          stack: err.stack,
        },
      },
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      userMessage: 'פג תוקף הכניסה. נדרשת כניסה מחדש.',
      debugInfo: {
        code: 'JWT_INVALID',
        source: `${req.method} ${req.path}`,
        detail: err.message,
      },
    };
  }

  // Fallback
  return {
    statusCode: 500,
    userMessage: 'שגיאת שרת פנימית. אנא נסה שנית.',
    debugInfo: {
      code: 'UNHANDLED_ERROR',
      source: `${req.method} ${req.path}`,
      detail: err.message,
      meta: { name: err.name, stack: err.stack },
    },
  };
}

/**
 * Central error-handling middleware. Mount AFTER all routes.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as any).requestId as string | undefined;
  const isProduction = process.env.NODE_ENV === 'production';

  let statusCode: number;
  let userMessage: string;
  let debugInfo: ErrorDebugInfo;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    userMessage = err.userMessage;
    debugInfo = err.debugInfo;
  } else {
    const classified = classifyError(err, req);
    statusCode = classified.statusCode;
    userMessage = classified.userMessage;
    debugInfo = classified.debugInfo;
  }

  // ── Structured log for console / log aggregators ──────────
  const logEntry = {
    level: statusCode >= 500 ? 'ERROR' : 'WARN',
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    errorCode: debugInfo.code,
    source: debugInfo.source,
    detail: debugInfo.detail,
    meta: debugInfo.meta,
    userId: (req as any).user?.id,
    userRole: (req as any).user?.role,
  };

  if (statusCode >= 500) {
    console.error('[ERROR]', JSON.stringify(logEntry, null, 2));
  } else {
    console.warn('[WARN]', JSON.stringify(logEntry, null, 2));
  }

  // ── Send response ──────────────────────────────────────────
  const body: ErrorResponse = {
    error: userMessage,
    errorCode: debugInfo.code,
    requestId,
    timestamp: new Date().toISOString(),
  };

  if (!isProduction) {
    body.debug = debugInfo;
  }

  res.status(statusCode).json(body);
}
