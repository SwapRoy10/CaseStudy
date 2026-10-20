import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ApiError } from './errorHandler';

// Request validation with Zod, adapted from the template's validateRequest.
// Validates params, query and/or body before the controller runs, and passes the
// first problem to errorHandler as a 400 VALIDATION in our standard error shape.
//
//   router.put('/courses/:courseId/profile',
//     validate({ params: courseParams, body: profileBody }), saveProfile);

type Schemas = { params?: z.ZodType; query?: z.ZodType; body?: z.ZodType };

export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (!result.success) {
        const issue = result.error.issues[0];
        const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
        next(new ApiError(400, 'VALIDATION', `${where}${issue.message}`));
        return;
      }
      // req.query is a getter in Express 5, so parsed values go on res.locals
      res.locals[part] = result.data;
    }
    next();
  };
}

// Shared pieces. IDs are Postgres bigints sent as strings (see matching/types.ts).
export const idString = z.string().regex(/^\d+$/, 'must be a numeric id');
export const courseParams = z.object({ courseId: idString });
