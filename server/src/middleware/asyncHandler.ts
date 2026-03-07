import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler so that thrown/rejected errors
 * are forwarded to the Express error-handling middleware automatically.
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
