import { Id, Profile } from './types';

// Mock data access for now so matching can be built and tested on its own.
// The function signatures are what the real Postgres queries should implement.

// TODO: replace with real queries once the profile/enrollment tables are in.
// getCourseProfiles should only return complete profiles of students on the
// roster (Enrollment join), and read blocks in one batch, not per student (SDD 5.4).

const mockProfiles: Profile[] = [
  {
    profileId: '1',
    studentId: '101',
    courseId: '1',
    gradeGoal: 'A_TRACK',
    workStyle: 'GROUP',
    blocks: [
      { weekday: 1, startMinute: 540, endMinute: 660 }, // Mon 9:00-11:00
      { weekday: 3, startMinute: 780, endMinute: 900 }, // Wed 13:00-15:00
    ],
  },
  {
    profileId: '2',
    studentId: '102',
    courseId: '1',
    gradeGoal: 'A_TRACK',
    workStyle: 'GROUP',
    blocks: [
      { weekday: 1, startMinute: 600, endMinute: 720 }, // Mon 10:00-12:00
      { weekday: 3, startMinute: 840, endMinute: 960 }, // Wed 14:00-16:00
    ],
  },
  {
    profileId: '3',
    studentId: '103',
    courseId: '1',
    gradeGoal: 'A_TRACK',
    workStyle: 'SOLO',
    blocks: [{ weekday: 1, startMinute: 480, endMinute: 570 }], // Mon 8:00-9:30
  },
  {
    profileId: '4',
    studentId: '104',
    courseId: '1',
    gradeGoal: 'PASS_TRACK',
    workStyle: 'GROUP',
    blocks: [{ weekday: 1, startMinute: 540, endMinute: 660 }],
  },
  {
    profileId: '5',
    studentId: '105',
    courseId: '1',
    gradeGoal: 'A_TRACK',
    workStyle: 'GROUP',
    blocks: [{ weekday: 5, startMinute: 600, endMinute: 720 }], // Fri only, no overlap with 101
  },
  {
    profileId: '6',
    studentId: '106',
    courseId: '1',
    gradeGoal: 'A_TRACK',
    workStyle: 'GROUP',
    blocks: [{ weekday: 3, startMinute: 780, endMinute: 840 }], // Wed 13:00-14:00, no reviews yet
  },
  {
    // incomplete profile, no availability saved yet
    profileId: '7',
    studentId: '107',
    courseId: '1',
    gradeGoal: 'A_TRACK',
    workStyle: 'SOLO',
    blocks: [],
  },
];

// 103 has the best average but the least overlap, so tests can check
// that averages don't move anyone up
const mockAverages: Record<Id, number> = {
  '102': 3.2,
  '103': 4.9,
};

export async function getProfile(studentId: Id, courseId: Id): Promise<Profile | null> {
  return mockProfiles.find((p) => p.studentId === studentId && p.courseId === courseId) ?? null;
}

export async function getCourseProfiles(courseId: Id): Promise<Profile[]> {
  return mockProfiles.filter((p) => p.courseId === courseId);
}

// TODO: this belongs to the peer review module (sdd 3.3), swap in their getAverage when it exists.
// null = no reviews yet (UI shows "Not yet rated")
export async function getAverage(studentId: Id): Promise<number | null> {
  return mockAverages[studentId] ?? null;
}
