// collaborative code by the group and claude sonnet 5.5

import type { Request, Response } from 'express';
import { requireEnrolled } from '../enrollment/requireEnrolled';
import { toOwnProfile } from '../profile/ownProfile';
import { getOwnProfile, saveProfile } from '../storage';

// course from the url, student from the session, profile module checks

// get /api/courses/:courseId/profile, null until saved (sdd 6.3.2)
export async function getProfile(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };
  await requireEnrolled(res.locals.studentId, courseId);
  res.json(toOwnProfile(await getOwnProfile(BigInt(res.locals.studentId), courseId)));
}

// put /api/courses/:courseId/profile
export async function putProfile(req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };
  res.json(toOwnProfile(await saveProfile(BigInt(res.locals.studentId), courseId, req.body)));
}
