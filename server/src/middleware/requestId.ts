import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Attaches a unique request ID to every incoming request.
 * The ID is available as `req.requestId` and returned in the `X-Request-Id` header.
 * Use this to correlate frontend errors with server logs.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || `req_${crypto.randomBytes(8).toString('hex')}`;
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
