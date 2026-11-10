import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = (err.issues || (err as any).errors || []).map((e: any) => ({
          path: Array.isArray(e.path) ? e.path.join('.') : String(e.path),
          message: e.message,
        }));
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          issues,
        });
        return;
      }
      next(err);
    }
  };
}
