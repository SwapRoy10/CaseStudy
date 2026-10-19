import { AvailabilityBlock, GradeGoal, Profile, WorkStyle } from './types';

// helpers shared by the matching tests

// takes hours so tests read like a schedule, 9.5 = 9:30
export function block(weekday: number, start: number, end: number): AvailabilityBlock {
  return { weekday, startMinute: start * 60, endMinute: end * 60 };
}

export function profile(
  id: string,
  goal: GradeGoal,
  style: WorkStyle,
  blocks: AvailabilityBlock[] = [block(1, 9, 11)],
  courseId = '1'
): Profile {
  return { profileId: 'p' + id, studentId: id, courseId, gradeGoal: goal, workStyle: style, blocks };
}

export const ids = (list: { studentId: string }[]) => list.map((c) => c.studentId);
