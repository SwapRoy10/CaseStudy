// collaborative code by the group and claude sonnet 5.5

import { isEnrolled } from '../matching/data';
import { StateConflictError } from '../matching/errors';

// roster check for read only course routes, runs first
export async function requireEnrolled(studentId: string, courseId: string) {
  if (!(await isEnrolled(studentId, courseId))) {
    throw new StateConflictError('NOT_ENROLLED', 'Your enrollment in this class could not be verified.');
  }
}
