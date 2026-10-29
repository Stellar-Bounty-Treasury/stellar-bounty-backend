import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          issues: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
        return;
      }
      next(err);
    }
  };
}
