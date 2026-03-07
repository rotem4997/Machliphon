/**
 * Structured error classes for the Machliphon server.
 *
 * User-facing messages are in Hebrew.
 * The `debugInfo` object carries technical context for logs / agent debugging.
 */

export interface ErrorDebugInfo {
  /** Machine-readable error code, e.g. "SUBSTITUTE_NOT_FOUND" */
  code: string;
  /** The route / handler where the error originated */
  source: string;
  /** Original error message (English, for developer logs) */
  detail: string;
  /** Any extra context (query params, IDs, etc.) */
  meta?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly debugInfo: ErrorDebugInfo;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    userMessage: string,
    debugInfo: ErrorDebugInfo,
    isOperational = true,
  ) {
    super(debugInfo.detail);
    this.statusCode = statusCode;
    this.userMessage = userMessage;
    this.debugInfo = debugInfo;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Convenience subclasses ────────────────────────────────────

export class ValidationError extends AppError {
  constructor(userMessage: string, debugInfo: Omit<ErrorDebugInfo, 'code'> & { code?: string }) {
    super(400, userMessage, { code: 'VALIDATION_ERROR', ...debugInfo });
  }
}

export class AuthenticationError extends AppError {
  constructor(userMessage: string, debugInfo: Omit<ErrorDebugInfo, 'code'> & { code?: string }) {
    super(401, userMessage, { code: 'AUTH_ERROR', ...debugInfo });
  }
}

export class ForbiddenError extends AppError {
  constructor(userMessage: string, debugInfo: Omit<ErrorDebugInfo, 'code'> & { code?: string }) {
    super(403, userMessage, { code: 'FORBIDDEN', ...debugInfo });
  }
}

export class NotFoundError extends AppError {
  constructor(userMessage: string, debugInfo: Omit<ErrorDebugInfo, 'code'> & { code?: string }) {
    super(404, userMessage, { code: 'NOT_FOUND', ...debugInfo });
  }
}

export class ConflictError extends AppError {
  constructor(userMessage: string, debugInfo: Omit<ErrorDebugInfo, 'code'> & { code?: string }) {
    super(409, userMessage, { code: 'CONFLICT', ...debugInfo });
  }
}

export class DatabaseError extends AppError {
  constructor(debugInfo: Omit<ErrorDebugInfo, 'code'> & { code?: string }) {
    super(500, 'שגיאה בגישה למסד הנתונים. אנא נסה שנית.', { code: 'DB_ERROR', ...debugInfo }, false);
  }
}

export class InternalError extends AppError {
  constructor(debugInfo: Omit<ErrorDebugInfo, 'code'> & { code?: string }) {
    super(500, 'שגיאת שרת פנימית. אנא נסה שנית.', { code: 'INTERNAL_ERROR', ...debugInfo }, false);
  }
}
