import type { Request, Response } from 'express';
import { importRosterWithReasons } from '../enrollment/enrollment.service';
import { ValidationError } from '../errors';

// POST /api/operator/courses/:courseId/roster
// the body is the roster file itself, sent as text/csv. the operator key is
// checked in the route before this runs. errors bubble to errorHandler.
export async function importRosterFile(req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };

  // express leaves the body empty unless it arrived as text
  const text = typeof req.body === 'string' ? req.body : '';
  if (!text.trim()) throw new ValidationError(['file']);

  const result = await importRosterWithReasons(courseId, text);
  if (!result.ok) {
    // a bad file isn't an error in our code, so it's answered here with the rows listed (sdd 6.4)
    res.status(400).json({
      error: { code: 'VALIDATION', message: 'Some rows could not be matched, so nothing was imported.', rows: result.rows },
    });
    return;
  }
  res.json({ enrolled: result.total, added: result.added });
}
