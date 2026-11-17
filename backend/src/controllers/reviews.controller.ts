import type { Request, Response } from 'express';
import { z } from 'zod';
import { idString } from '../middleware/validate';
import { submitReview } from '../storage';

export const groupParams = z.object({ groupId: idString });

// POST /api/groups/:groupId/reviews
// the body is checked in the service, so a missing rating comes back as a
// VALIDATION error that names the field
export async function postReview(req: Request, res: Response) {
  const { groupId } = res.locals.params as { groupId: string };
  res.status(201).json(await submitReview(BigInt(res.locals.studentId), groupId, req.body));
}
