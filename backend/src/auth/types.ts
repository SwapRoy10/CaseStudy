// collaborative code by the group and claude sonnet 5.5

// what the sign in code needs to know about a student
export interface Account {
  id: string;
  name: string;
  passwordHash: string;
  tutorialCompleted: boolean;
}

// one course the student is on the roster of
export interface MyCourse {
  id: string;
  code: string;
  title: string;
  section: string;
  term: string;
  hasProfile: boolean;
}

export interface Me {
  studentId: string;
  name: string;
  tutorialCompleted: boolean;
  courses: MyCourse[];
}
