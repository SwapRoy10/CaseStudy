import type { Request, Response } from 'express';
import { requireEnrolled } from '../enrollment/requireEnrolled';
import { toOwnProfile } from '../profile/ownProfile';
import { getOwnProfile, saveProfile } from '../storage';

// the profile module already checks the input and the roster, these just hand
// it the course from the url and the student from the session

// GET /api/courses/:courseId/profile
// null until the student has saved one (sdd 6.3.2), and 409 if they aren't on the course
export async function getProfile(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };
  await requireEnrolled(res.locals.studentId, courseId);
  res.json(toOwnProfile(await getOwnProfile(BigInt(res.locals.studentId), courseId)));
}

// PUT /api/courses/:courseId/profile
export async function putProfile(req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };
  res.json(toOwnProfile(await saveProfile(BigInt(res.locals.studentId), courseId, req.body)));
}
