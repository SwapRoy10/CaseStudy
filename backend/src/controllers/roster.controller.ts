// collaborative code by the group and claude sonnet 5.5

import type { Request, Response } from 'express';
import { z } from 'zod';
import { importRosterWithReasons } from '../enrollment/enrollment.service';
import { ValidationError } from '../errors';

export const rosterQuery = z.object({ createAccounts: z.enum(['true', 'false']).optional() });

// post /api/operator/courses/:courseId/roster, csv body, ?createAccounts=true
export async function importRosterFile(req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };

  // express leaves the body empty unless it came as text
  const text = typeof req.body === 'string' ? req.body : '';
  if (!text.trim()) throw new ValidationError(['file']);

  const { createAccounts } = res.locals.query as z.infer<typeof rosterQuery>;
  const result = await importRosterWithReasons(courseId, text, { createAccounts: createAccounts === 'true' });
  if (!result.ok) {
    // bad file is not a server error, answer with the bad rows (sdd 6.4)
    res.status(400).json({
      error: { code: 'VALIDATION', message: 'Some rows could not be matched, so nothing was imported.', rows: result.rows },
    });
    return;
  }
  // response has first passwords, keep it out of caches
  res.set('Cache-Control', 'no-store');
  res.json({ enrolled: result.total, added: result.added, created: result.accounts.length, accounts: result.accounts });
}
