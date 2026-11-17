import { prisma } from '../db';
import { GradeGoal, WorkStyle } from '@prisma/client';
import { respond, sendRequest } from './requests.service';

// a small class of its own for the request, group and review tests, so they
// don't touch the sample data other tests read. cleanup() removes all of it.

export interface Spec {
  goal?: GradeGoal;
  style?: WorkStyle;
  // [weekday, start hour, end hour] for each block. null means no profile at all
  blocks?: [number, number, number][] | null;
}

const MONDAY_MORNING: [number, number, number][] = [[1, 9, 11]];

export async function makeClass(tag: string, specs: Spec[]) {
  const course = await prisma.course.create({ data: { code: tag, section: '001', term: 'Test' } });

  const ids: bigint[] = [];
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const student = await prisma.student.create({
      data: { name: `Student ${tag} ${i}`, schoolEmail: `${tag}-${i}@test.edu`, passwordHash: 'x' },
    });
    ids.push(student.id);
    await prisma.enrollment.create({ data: { studentId: student.id, courseId: course.id } });

    if (spec.blocks === null) continue;
    await prisma.profile.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        gradeGoal: spec.goal ?? 'A_TRACK',
        workStyle: spec.style ?? 'GROUP',
        blocks: {
          create: (spec.blocks ?? MONDAY_MORNING).map(([weekday, start, end]) => ({
            weekday,
            startMinute: start * 60,
            endMinute: end * 60,
          })),
        },
      },
    });
  }

  async function cleanup() {
    await prisma.peerReview.deleteMany({ where: { group: { courseId: course.id } } });
    await prisma.groupMembership.deleteMany({ where: { courseId: course.id } });
    await prisma.studyGroup.deleteMany({ where: { courseId: course.id } });
    await prisma.matchRequest.deleteMany({ where: { courseId: course.id } });
    await prisma.profile.deleteMany({ where: { courseId: course.id } });
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } });
    await prisma.student.deleteMany({ where: { id: { in: ids } } });
    await prisma.course.delete({ where: { id: course.id } });
  }

  return { courseId: course.id, ids, cleanup };
}

// x asks y and y says yes, the normal way two students end up in a group
export async function match(courseId: bigint, x: bigint, y: bigint) {
  const sent = await sendRequest(x, courseId.toString(), y.toString());
  return respond(y, sent.requestId, 'ACCEPT');
}
