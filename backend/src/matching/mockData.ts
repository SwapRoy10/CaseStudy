import { Id, Profile } from './types';

// In-memory stand-in for data.ts. Tests use it so matching can be checked
// without a database; the exported functions have the same signatures.

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

// like the real query, only profiles that have availability come back
export async function getCourseProfiles(courseId: Id): Promise<Profile[]> {
  return mockProfiles.filter((p) => p.courseId === courseId && p.blocks.length > 0);
}

// 108 is on the roster but hasn't saved a profile
const enrolledWithoutProfile: Id[] = ['108'];

export async function isEnrolled(studentId: Id, courseId: Id): Promise<boolean> {
  return (
    enrolledWithoutProfile.includes(studentId) ||
    mockProfiles.some((p) => p.studentId === studentId && p.courseId === courseId)
  );
}

// no entry = no reviews yet
export async function getAverages(studentIds: Id[]): Promise<Map<Id, number>> {
  const found = studentIds.filter((id) => id in mockAverages);
  return new Map(found.map((id) => [id, mockAverages[id]]));
}
