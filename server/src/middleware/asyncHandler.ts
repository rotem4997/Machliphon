import { Request, Response, NextFunction } from 'express';

export const asyncHandler = <TReq extends Request = Request>(
  fn: (req: TReq, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };
};
