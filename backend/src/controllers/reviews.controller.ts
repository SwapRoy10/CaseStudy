// collaborative code by the group and claude sonnet 5.5

import type { Request, Response } from 'express';
import { z } from 'zod';
import { idString } from '../middleware/validate';
import { submitReview } from '../storage';

export const groupParams = z.object({ groupId: idString });

// post /api/groups/:groupId/reviews, the service checks the body
export async function postReview(req: Request, res: Response) {
  const { groupId } = res.locals.params as { groupId: string };
  res.status(201).json(await submitReview(BigInt(res.locals.studentId), groupId, req.body));
}
