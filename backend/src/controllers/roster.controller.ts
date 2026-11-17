import type { Request, Response } from 'express';
import { z } from 'zod';
import { importRosterWithReasons } from '../enrollment/enrollment.service';
import { ValidationError } from '../errors';

export const rosterQuery = z.object({ createAccounts: z.enum(['true', 'false']).optional() });

// POST /api/operator/courses/:courseId/roster
// the body is the roster file itself, sent as text/csv. the operator key is
// checked in the route before this runs. errors bubble to errorHandler.
// ?createAccounts=true makes an account for any student who doesn't have one.
export async function importRosterFile(req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };

  // express leaves the body empty unless it arrived as text
  const text = typeof req.body === 'string' ? req.body : '';
  if (!text.trim()) throw new ValidationError(['file']);

  const { createAccounts } = res.locals.query as z.infer<typeof rosterQuery>;
  const result = await importRosterWithReasons(courseId, text, { createAccounts: createAccounts === 'true' });
  if (!result.ok) {
    // a bad file isn't an error in our code, so it's answered here with the rows listed (sdd 6.4)
    res.status(400).json({
      error: { code: 'VALIDATION', message: 'Some rows could not be matched, so nothing was imported.', rows: result.rows },
    });
    return;
  }
  // first passwords are in this answer, so keep it out of any cache
  res.set('Cache-Control', 'no-store');
  res.json({ enrolled: result.total, added: result.added, created: result.accounts.length, accounts: result.accounts });
}
