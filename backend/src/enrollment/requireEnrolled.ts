import { isEnrolled } from '../matching/data';
import { StateConflictError } from '../matching/errors';

// the roster check for the course routes that only read. it runs before any data
// is read, so a student who isn't on the course gets 409 NOT_ENROLLED and learns
// nothing else about it (testing doc PROF-8, CRS-2, GRP-5). saves and requests
// check the roster in their own transactions.
export async function requireEnrolled(studentId: string, courseId: string) {
  if (!(await isEnrolled(studentId, courseId))) {
    throw new StateConflictError('NOT_ENROLLED', 'Your enrollment in this class could not be verified.');
  }
}
