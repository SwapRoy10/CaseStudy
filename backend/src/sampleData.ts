import { AvailabilityBlock, GradeGoal, WorkStyle } from './matching/types';

// every student, course and review we load for local dev and the demo.
// prisma/seed.ts writes this into postgres, and matching/mockData.ts reads it
// straight from here when there's no database, so both always match.
//
// courses 1 and 2 are the sample data from the functional testing doc (5.5.1,
// figure 1). a lot of tests depend on them exactly, so don't change them.
// course 3 is the real class, csds 393, with a full roster.
// names and emails are made up. nothing in the app ever sends email.

export interface SampleCourse {
  id: string;
  code: string;
  title: string;
  section: string;
  term: string;
}

export interface SampleStudent {
  id: string;
  name: string;
  email: string;
}

export interface SampleProfile {
  studentId: string;
  courseId: string;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  blocks: AvailabilityBlock[];
}

export interface SampleReview {
  groupId: string;
  reviewerId: string;
  revieweeId: string;
  communication: number;
  reliability: number;
  contribution: number;
}

// weekdays the same way the database stores them, 0 is sunday
const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;

// takes hours so schedules are easy to read, 13.5 means 1:30pm
function h(weekday: number, start: number, end: number): AvailabilityBlock {
  return { weekday, startMinute: Math.round(start * 60), endMinute: Math.round(end * 60) };
}

export const SAMPLE_COURSE = '1';
export const SECOND_SAMPLE_COURSE = '2';
export const CSDS_393 = '3';

export const courses: SampleCourse[] = [
  { id: '1', code: 'SAMPLE 101', title: 'Sample Course (testing doc data)', section: '001', term: 'Fall 2026' },
  { id: '2', code: 'SAMPLE 102', title: 'Second Sample Course', section: '001', term: 'Fall 2026' },
  { id: '3', code: 'CSDS 393', title: 'Software Engineering', section: '100', term: 'Fall 2026' },
  // past semester, only here so students have peer reviews from earlier groups
  { id: '4', code: 'CSDS 132', title: 'Introduction to Programming in Java', section: '100', term: 'Spring 2026' },
  { id: '5', code: 'CSDS 233', title: 'Introduction to Data Structures', section: '100', term: 'Spring 2026' },
];

export const students: SampleStudent[] = [
  // sample data from the testing doc
  { id: '101', name: 'Alex Rivera', email: 'axr101@case.edu' },
  { id: '102', name: 'Brianna Cole', email: 'bxc102@case.edu' },
  { id: '103', name: 'Chris Yamamoto', email: 'cxy103@case.edu' },
  { id: '104', name: 'Dana Whitfield', email: 'dxw104@case.edu' },
  { id: '105', name: 'Elijah Ford', email: 'exf105@case.edu' },
  { id: '106', name: 'Farah Nasser', email: 'fxn106@case.edu' },
  { id: '107', name: 'Gabe Lowry', email: 'gxl107@case.edu' },
  { id: '108', name: 'Hailey Quinn', email: 'hxq108@case.edu' },
  { id: '501', name: 'Jenna Marsh', email: 'jxm501@case.edu' },
  { id: '999', name: 'Ivan Sokolov', email: 'ixs999@case.edu' },

  // csds 393 roster
  { id: '1001', name: 'Maya Chen', email: 'mxc1001@case.edu' },
  { id: '1002', name: 'Jordan Brooks', email: 'jxb1002@case.edu' },
  { id: '1003', name: 'Priya Raman', email: 'pxr1003@case.edu' },
  { id: '1004', name: 'Ethan Walsh', email: 'exw1004@case.edu' },
  { id: '1005', name: 'Sofia Alvarez', email: 'sxa1005@case.edu' },
  { id: '1006', name: 'Daniel Okafor', email: 'dxo1006@case.edu' },
  { id: '1007', name: 'Hannah Lindqvist', email: 'hxl1007@case.edu' },
  { id: '1008', name: 'Marcus Bell', email: 'mxb1008@case.edu' },
  { id: '1009', name: 'Aisha Rahman', email: 'axr1009@case.edu' },
  { id: '1010', name: 'Tyler Novak', email: 'txn1010@case.edu' },
  { id: '1011', name: 'Grace Kim', email: 'gxk1011@case.edu' },
  { id: '1012', name: 'Luis Herrera', email: 'lxh1012@case.edu' },
  { id: '1013', name: 'Olivia Grant', email: 'oxg1013@case.edu' },
  { id: '1014', name: 'Arjun Mehta', email: 'axm1014@case.edu' },
  { id: '1015', name: 'Chloe Dubois', email: 'cxd1015@case.edu' },
  { id: '1016', name: 'Samuel Adeyemi', email: 'sxa1016@case.edu' },
  { id: '1017', name: 'Emily Carter', email: 'exc1017@case.edu' },
  { id: '1018', name: 'Kevin Tran', email: 'kxt1018@case.edu' },
  { id: '1019', name: 'Natalie Rossi', email: 'nxr1019@case.edu' },
  { id: '1020', name: 'Omar Haddad', email: 'oxh1020@case.edu' },
  { id: '1021', name: 'Rachel Goldberg', email: 'rxg1021@case.edu' },
  { id: '1022', name: 'Isaac Mensah', email: 'ixm1022@case.edu' },
  { id: '1023', name: 'Lily Zhang', email: 'lxz1023@case.edu' },
  { id: '1024', name: 'Noah Fischer', email: 'nxf1024@case.edu' },
  { id: '1025', name: 'Fatima Siddiqui', email: 'fxs1025@case.edu' },
  { id: '1026', name: 'Caleb Morgan', email: 'cxm1026@case.edu' },
  { id: '1027', name: 'Zoe Papadopoulos', email: 'zxp1027@case.edu' },
  { id: '1028', name: "Ryan O'Connell", email: 'rxo1028@case.edu' },
  { id: '1029', name: 'Mei Tanaka', email: 'mxt1029@case.edu' },
  { id: '1030', name: 'Andre Washington', email: 'axw1030@case.edu' },
  { id: '1031', name: 'Sara Lindgren', email: 'sxl1031@case.edu' },
  { id: '1032', name: 'Victor Petrov', email: 'vxp1032@case.edu' },
  { id: '1033', name: 'Ines Moreau', email: 'ixm1033@case.edu' },
  { id: '1034', name: 'Jacob Silva', email: 'jxs1034@case.edu' },
  { id: '1035', name: 'Amara Nwosu', email: 'axn1035@case.edu' },
  { id: '1036', name: 'Ben Hughes', email: 'bxh1036@case.edu' },
];

export const profiles: SampleProfile[] = [
  // course 1, figure 1 in the testing doc
  { studentId: '101', courseId: '1', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(MON, 9, 11), h(WED, 13, 15)] },
  { studentId: '102', courseId: '1', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(MON, 10, 12), h(WED, 14, 16)] },
  { studentId: '103', courseId: '1', gradeGoal: 'A_TRACK', workStyle: 'SOLO', blocks: [h(MON, 8, 9.5)] },
  { studentId: '104', courseId: '1', gradeGoal: 'PASS_TRACK', workStyle: 'GROUP', blocks: [h(MON, 9, 11)] },
  { studentId: '105', courseId: '1', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(FRI, 10, 12)] },
  { studentId: '106', courseId: '1', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(WED, 13, 14)] },
  // on purpose: a saved profile with no free time, which a normal save would refuse.
  // POOL-2 uses it to check that path
  { studentId: '107', courseId: '1', gradeGoal: 'A_TRACK', workStyle: 'SOLO', blocks: [] },

  // course 2, only for the cross-course checks. 501 has the same profile as 102
  { studentId: '501', courseId: '2', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(MON, 10, 12), h(WED, 14, 16)] },

  // csds 393. most people have a couple of afternoon slots between classes and
  // some evening or weekend time, like a real schedule would look
  { studentId: '1001', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(MON, 14, 16), h(WED, 14, 16), h(SUN, 13, 16)] },
  { studentId: '1002', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(MON, 15, 17), h(THU, 19, 21), h(SUN, 14, 17)] },
  { studentId: '1003', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'SOLO', blocks: [h(TUE, 10, 11.5), h(THU, 10, 11.5), h(SAT, 10, 12)] },
  { studentId: '1004', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'GROUP', blocks: [h(MON, 18, 20), h(WED, 18, 20)] },
  { studentId: '1005', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(TUE, 13, 15), h(THU, 13, 15), h(SUN, 15, 18)] },
  { studentId: '1006', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'SOLO', blocks: [h(FRI, 13, 16)] },
  { studentId: '1007', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(MON, 14, 15), h(MON, 15, 16), h(WED, 19, 21)] },
  { studentId: '1008', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'GROUP', blocks: [h(TUE, 18, 20), h(THU, 18, 20), h(SAT, 13, 15)] },
  { studentId: '1009', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(MON, 14, 16), h(TUE, 13, 14), h(THU, 19, 21)] },
  { studentId: '1010', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'SOLO', blocks: [h(WED, 10, 12), h(FRI, 10, 12)] },
  { studentId: '1011', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(SUN, 13, 17), h(WED, 14, 15.5)] },
  { studentId: '1012', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'GROUP', blocks: [h(MON, 18, 19.5), h(WED, 18.5, 20), h(SUN, 19, 21)] },
  { studentId: '1013', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(TUE, 13, 15), h(THU, 19, 20), h(SAT, 10, 11)] },
  { studentId: '1014', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'SOLO', blocks: [h(MON, 15, 16), h(WED, 15, 16), h(FRI, 15, 16)] },
  { studentId: '1015', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'SOLO', blocks: [h(TUE, 18, 19), h(SAT, 14, 16)] },
  { studentId: '1016', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(THU, 19, 22), h(SUN, 14, 16)] },
  { studentId: '1017', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(MON, 9, 10), h(WED, 9, 10), h(FRI, 9, 10)] },
  { studentId: '1018', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'GROUP', blocks: [h(MON, 19, 21), h(TUE, 18.5, 20)] },
  { studentId: '1019', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'SOLO', blocks: [h(TUE, 10, 12), h(SUN, 15, 17)] },
  { studentId: '1020', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(MON, 14.5, 16), h(THU, 13, 14.5), h(SUN, 13, 15)] },
  { studentId: '1021', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'SOLO', blocks: [h(FRI, 14, 17), h(SAT, 13, 14)] },
  { studentId: '1022', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(WED, 19, 21), h(THU, 19, 21)] },
  { studentId: '1023', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(TUE, 13.5, 15), h(SUN, 14, 15)] },
  { studentId: '1024', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'GROUP', blocks: [h(MON, 18, 19), h(WED, 18, 19), h(SUN, 20, 22)] },
  { studentId: '1025', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'SOLO', blocks: [h(WED, 10, 11.5), h(SAT, 10, 12)] },
  { studentId: '1026', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(MON, 14, 15), h(WED, 14, 15), h(THU, 20, 21)] },
  { studentId: '1027', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'GROUP', blocks: [h(TUE, 19, 21), h(THU, 18, 19)] },
  { studentId: '1028', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(SUN, 13, 14), h(SUN, 16, 18)] },
  { studentId: '1029', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'SOLO', blocks: [h(MON, 10, 11), h(TUE, 13, 14), h(FRI, 10, 11)] },
  { studentId: '1030', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'SOLO', blocks: [h(WED, 18, 19.5)] },
  { studentId: '1031', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(THU, 13, 15), h(SAT, 10, 12), h(SUN, 13, 15)] },
  { studentId: '1032', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [h(FRI, 18, 21)] },
  { studentId: '1033', courseId: '3', gradeGoal: 'PASS_TRACK', workStyle: 'GROUP', blocks: [h(MON, 18.5, 20), h(SAT, 14, 15)] },
  { studentId: '1034', courseId: '3', gradeGoal: 'A_TRACK', workStyle: 'SOLO', blocks: [h(TUE, 10.5, 12), h(THU, 10.5, 12)] },
  // 1035 and 1036 are on the roster but haven't made a profile yet
];

// groups from last semester. a student can only be in one group per course
export const pastGroups: { id: string; courseId: string; members: string[] }[] = [
  // gives 102 and 103 the review averages the testing doc expects (3.2 and 4.9)
  { id: '1', courseId: '4', members: ['102', '103', '1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008', '1009', '1010'] },
  { id: '2', courseId: '5', members: ['1001', '1003', '1011', '1014'] },
  { id: '3', courseId: '5', members: ['1002', '1008', '1016', '1020'] },
  { id: '4', courseId: '5', members: ['1005', '1012', '1019', '1023', '1027'] },
  { id: '5', courseId: '5', members: ['1009', '1013', '1021', '1025'] },
];

// who is on which roster. everyone with a profile or a past group is enrolled,
// plus a few people who joined but haven't made a profile
export const enrollments: { studentId: string; courseId: string }[] = [
  ...profiles.map((p) => ({ studentId: p.studentId, courseId: p.courseId })),
  ...pastGroups.flatMap((g) => g.members.map((m) => ({ studentId: m, courseId: g.courseId }))),
  { studentId: '108', courseId: '1' }, // on the roster, no profile yet
  { studentId: '105', courseId: '2' }, // the one student on both sample rosters
  { studentId: '1035', courseId: '3' },
  { studentId: '1036', courseId: '3' },
];

// what each student got from every groupmate in csds 233, as
// [communication, reliability, contribution]. people not listed have no reviews yet
const ratingsFromGroupmates: Record<string, [number, number, number]> = {
  '1001': [5, 5, 4], '1003': [5, 4, 5], '1011': [4, 4, 4], '1014': [3, 4, 3],
  '1002': [4, 3, 4], '1008': [2, 3, 3], '1016': [5, 5, 5], '1020': [4, 4, 5],
  '1005': [3, 3, 3], '1012': [4, 5, 4], '1019': [5, 4, 4], '1023': [4, 4, 3], '1027': [5, 5, 4],
  '1009': [4, 5, 5], '1013': [3, 3, 4], '1021': [4, 4, 4], '1025': [5, 5, 5],
};

function review(groupId: string, reviewerId: string, revieweeId: string, r: [number, number, number]): SampleReview {
  return { groupId, reviewerId, revieweeId, communication: r[0], reliability: r[1], contribution: r[2] };
}

function buildReviews(): SampleReview[] {
  const list: SampleReview[] = [];

  // 102 gets 15 ratings that add up to 48, so 3.2
  const for102: [number, number, number][] = [[3, 3, 4], [3, 3, 3], [4, 3, 3], [3, 3, 3], [3, 4, 3]];
  for102.forEach((r, i) => list.push(review('1', String(1001 + i), '102', r)));

  // 103 gets 30 ratings that add up to 147, so 4.9
  for (let i = 0; i < 10; i++) {
    list.push(review('1', String(1001 + i), '103', i === 0 ? [4, 4, 4] : [5, 5, 5]));
  }

  // csds 233 groups, everyone reviews everyone else in their group
  for (const g of pastGroups.filter((g) => g.courseId === '5')) {
    for (const reviewer of g.members) {
      for (const reviewee of g.members) {
        if (reviewer !== reviewee && ratingsFromGroupmates[reviewee]) {
          list.push(review(g.id, reviewer, reviewee, ratingsFromGroupmates[reviewee]));
        }
      }
    }
  }
  return list;
}

export const reviews: SampleReview[] = buildReviews();

// average over every rating a student has received, null if none.
// same math as the sql in matching/postgresData.ts
export function reviewAverage(studentId: string): number | null {
  const mine = reviews.filter((r) => r.revieweeId === studentId);
  if (mine.length === 0) return null;
  const total = mine.reduce((sum, r) => sum + r.communication + r.reliability + r.contribution, 0);
  return total / (mine.length * 3);
}
