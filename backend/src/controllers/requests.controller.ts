import type { Request, Response } from 'express';
import { z } from 'zod';
import { idString } from '../middleware/validate';
import * as groups from '../requests/groups.service';
import * as requests from '../requests/requests.service';

// thin on purpose, like the candidates controller: the student comes from the
// session, the checks and transactions are in the services, and errors bubble to
// errorHandler.

const me = (res: Response) => BigInt(res.locals.studentId);

export const sendBody = z.object({ recipientId: idString });
export const respondBody = z.object({ decision: z.enum(['ACCEPT', 'DECLINE']) });
export const requestParams = z.object({ requestId: idString });
export const memberParams = z.object({ courseId: idString, studentId: idString });

// POST /api/courses/:courseId/requests
export async function sendRequest(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };
  const { recipientId } = res.locals.body as z.infer<typeof sendBody>;
  res.status(201).json(await requests.sendRequest(me(res), courseId, recipientId));
}

// GET /api/courses/:courseId/requests
export async function listRequests(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };
  res.json({ courseId, requests: await requests.listRequests(me(res), courseId) });
}

// POST /api/requests/:requestId/response
export async function respond(_req: Request, res: Response) {
  const { requestId } = res.locals.params as { requestId: string };
  const { decision } = res.locals.body as z.infer<typeof respondBody>;
  res.json(await requests.respond(me(res), requestId, decision));
}

// POST /api/requests/:requestId/cancel
export async function cancel(_req: Request, res: Response) {
  const { requestId } = res.locals.params as { requestId: string };
  res.json(await requests.cancel(me(res), requestId));
}

// GET /api/courses/:courseId/group
export async function getGroup(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };
  res.json({ group: await groups.getGroup(me(res), courseId) });
}

// GET /api/courses/:courseId/members/:studentId
export async function getMember(_req: Request, res: Response) {
  const { courseId, studentId } = res.locals.params as { courseId: string; studentId: string };
  res.json(await groups.getMatchedProfile(me(res), courseId, studentId));
}
