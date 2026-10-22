import { useState } from 'react';
import { setDemoStudent } from './services/api';
import { ConnectionStatus } from './components/ConnectionStatus';
import { CandidatesPage } from './pages/CandidatesPage';

// Students in the backend's mock data (backend/src/matching/data.ts), all in course 1.
// Remove the picker once real login exists.
const DEMO_STUDENTS = [
  { id: '101', note: 'A track, group' },
  { id: '102', note: 'A track, group' },
  { id: '103', note: 'A track, solo' },
  { id: '104', note: 'Pass track' },
  { id: '105', note: 'Fridays only' },
  { id: '107', note: 'No availability yet' },
];
const DEMO_COURSE = '1';

export default function App() {
  const [studentId, setStudentId] = useState(DEMO_STUDENTS[0].id);
  // Set synchronously so the page's first request already carries the id
  setDemoStudent(studentId);

  return (
    <div className="shell">
      <header className="topbar">
      <div>
          <h1>CaseStudy</h1>
          <p className="muted">Find study partners in your course</p>
        </div>        
        <ConnectionStatus />
      </header>

      <div className="demo-bar">
        <label>
          Demo student{' '}
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {DEMO_STUDENTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.note}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">Course {DEMO_COURSE}</span>
      </div>

      <main>
        <CandidatesPage studentId={studentId} courseId={DEMO_COURSE} />
      </main>
    </div>
  );
}
