import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ApiError } from './errorHandler';

// zod validation from the template, first problem goes to errorHandler as 400

type Schemas = { params?: z.ZodType; query?: z.ZodType; body?: z.ZodType };

export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (!result.success) {
        // one problem at a time is enough to fix and resend
        const issue = result.error.issues[0];
        const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
        next(new ApiError(400, 'VALIDATION', `${where}${issue.message}`));
        return;
      }
      // req.query is a getter in express 5, so parsed values go on res.locals
      res.locals[part] = result.data;
    }
    next();
  };
}

// shared pieces, ids are bigints sent as strings (see matching/types.ts)
export const idString = z.string().regex(/^\d+$/, 'must be a numeric id');
export const courseParams = z.object({ courseId: idString });
