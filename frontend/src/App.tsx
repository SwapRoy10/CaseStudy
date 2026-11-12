import { useEffect, useState } from 'react';
import { api, setDemoStudent } from './services/api';
import type { DemoCourse, Id } from './types/api';
import { ConnectionStatus } from './components/ConnectionStatus';
import { CandidatesPage } from './pages/CandidatesPage';
import { ProfilePage } from './pages/ProfilePage';

export default function App() {
  const [roster, setRoster] = useState<DemoCourse[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<Id>('');
  const [studentId, setStudentId] = useState<Id>('');
  const [page, setPage] = useState<'matches' | 'profile'>('matches');

  // set right away so the page's first request already carries the id
  setDemoStudent(studentId || null);

  // there's no sign in yet, so we load everyone you could "be" from the backend
  useEffect(() => {
    api
      .getDemoRoster()
      .then((res) => {
        setRoster(res.courses);
        // start in csds 393 since that's the real class
        const start = res.courses.find((c) => c.code === 'CSDS 393') ?? res.courses[0];
        if (start) pickCourse(start);
      })
      .catch((err: Error) => setRosterError(err.message));
  }, []);

  // switching course also switches to someone on that roster who has a profile
  function pickCourse(course: DemoCourse) {
    setCourseId(course.id);
    const first = course.students.find((s) => s.hasProfile) ?? course.students[0];
    setStudentId(first ? first.id : '');
  }

  const course = roster.find((c) => c.id === courseId);
  const student = course?.students.find((s) => s.id === studentId);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>CaseStudy</h1>
          <p className="muted">Find study partners in your course</p>
        </div>
        <ConnectionStatus />
      </header>

      {course && (
        <p className="course-title">
          {course.code}: {course.title} <span className="muted">{course.term}</span>
        </p>
      )}

      <nav className="tabs">
        <button className={page === 'matches' ? 'tab active' : 'tab'} onClick={() => setPage('matches')}>
          Matches
        </button>
        <button className={page === 'profile' ? 'tab active' : 'tab'} onClick={() => setPage('profile')}>
          My profile
        </button>
      </nav>

      <div className="demo-bar">
        <span className="muted">Demo sign in</span>
        <label>
          Course{' '}
          <select
            value={courseId}
            onChange={(e) => {
              const picked = roster.find((c) => c.id === e.target.value);
              if (picked) pickCourse(picked);
            }}
          >
            {roster.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Student{' '}
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {course?.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.hasProfile ? '' : ' (no profile yet)'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <main>
        {rosterError && (
          <div className="notice" role="alert">
            <p>{rosterError}</p>
          </div>
        )}
        {!rosterError && !course && <p className="muted">Loading your courses…</p>}
        {course && student && page === 'matches' && (
          <CandidatesPage studentId={studentId} courseId={courseId} studentName={student.name} />
        )}
        {course && page === 'profile' && <ProfilePage />}
      </main>
    </div>
  );
}
