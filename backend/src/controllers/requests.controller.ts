// collaborative code by somesh and claude sonnet 5.5

import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireEnrolled } from '../enrollment/requireEnrolled';
import { idString } from '../middleware/validate';
import * as storage from '../storage';

// thin, student from the session, checks live in the services

const me = (res: Response) => BigInt(res.locals.studentId);

export const sendBody = z.object({ recipientId: idString });
export const respondBody = z.object({ decision: z.enum(['ACCEPT', 'DECLINE']) });
export const requestParams = z.object({ requestId: idString });
export const memberParams = z.object({ courseId: idString, studentId: idString });

// post /api/courses/:courseId/requests
export async function sendRequest(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };
  const { recipientId } = res.locals.body as z.infer<typeof sendBody>;
  res.status(201).json(await storage.sendRequest(me(res), courseId, recipientId));
}

// get /api/courses/:courseId/requests
export async function listRequests(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };
  await requireEnrolled(res.locals.studentId, courseId);
  res.json({ courseId, requests: await storage.listRequests(me(res), courseId) });
}

// post /api/requests/:requestId/response
export async function respond(_req: Request, res: Response) {
  const { requestId } = res.locals.params as { requestId: string };
  const { decision } = res.locals.body as z.infer<typeof respondBody>;
  res.json(await storage.respond(me(res), requestId, decision));
}

// post /api/requests/:requestId/cancel
export async function cancel(_req: Request, res: Response) {
  const { requestId } = res.locals.params as { requestId: string };
  res.json(await storage.cancel(me(res), requestId));
}

// get /api/courses/:courseId/group
export async function getGroup(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };
  await requireEnrolled(res.locals.studentId, courseId);
  res.json({ group: await storage.getGroup(me(res), courseId) });
}

// get /api/courses/:courseId/members/:studentId
export async function getMember(_req: Request, res: Response) {
  const { courseId, studentId } = res.locals.params as { courseId: string; studentId: string };
  res.json(await storage.getMatchedProfile(me(res), courseId, studentId));
}
