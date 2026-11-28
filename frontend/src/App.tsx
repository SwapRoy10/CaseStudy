// collaborative code by somesh and claude sonnet 5.5

import { useEffect, useState } from 'react';
import { api, ApiRequestError, setSignedOutHandler } from './services/api';
import type { CourseSummary, Id, Me } from './types/api';
import { ConnectionStatus } from './components/ConnectionStatus';
import { TutorialDialog } from './components/TutorialDialog';
import { AccountPage } from './pages/AccountPage';
import { CandidatesPage } from './pages/CandidatesPage';
import { GroupPage } from './pages/GroupPage';
import { ProfilePage } from './pages/ProfilePage';
import { RequestsPage } from './pages/RequestsPage';
import { SignInPage } from './pages/SignInPage';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  // every course this term for the selector, student may not be on all
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  // true until /api/me answers, so sign in doesn't flash
  const [checking, setChecking] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<Id>('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [page, setPage] = useState<'matches' | 'requests' | 'group' | 'profile' | 'account'>('matches');

  // a 401 from any call means the session ended
  useEffect(() => {
    setSignedOutHandler(() => setMe(null));
    return () => setSignedOutHandler(null);
  }, []);

  // cookie survives a reload, so someone may already be signed in
  useEffect(() => {
    api
      .getMe()
      .then(start)
      .catch((err: unknown) => {
        // 401 just means nobody is signed in
        if (!(err instanceof ApiRequestError) || err.status !== 401) {
          setStartError(err instanceof Error ? err.message : 'Something went wrong.');
        }
      })
      .finally(() => setChecking(false));
  }, []);

  async function start(student: Me) {
    // list failed, fall back to the student's own courses
    const list = await api
      .getCourses()
      .then((r) => r.courses)
      .catch(() => student.courses.map((c) => ({ courseId: c.id, code: c.code, title: c.title, section: c.section, term: c.term })));
    setCourses(list);
    setMe(student);
    setHelpOpen(false);
    setPage('matches');
    // start in csds 393, or any course they are on
    const first = student.courses.find((c) => c.code === 'CSDS 393') ?? student.courses[0];
    setCourseId(first ? first.id : (list[0]?.courseId ?? ''));
  }

  async function handleSignOut() {
    // the cookie is cleared by the server, but if the call fails we still leave
    await api.signOut().catch(() => null);
    setMe(null);
  }

  const course = courses.find((c) => c.courseId === courseId);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>CaseStudy</h1>
        </div>
        <ConnectionStatus />
      </header>

      {checking && <p className="muted">Loading...</p>}

      {startError && (
        <div className="notice" role="alert">
          <p>{startError}</p>
        </div>
      )}

      {!checking && !startError && !me && <SignInPage onSignedIn={start} />}

      {me && (
        <>
          <div className="account-bar">
            <span className="who">
              <span>
                Signed in as <strong>{me.name}</strong>
              </span>
              <button onClick={() => setHelpOpen(true)}>Help</button>
              <button onClick={handleSignOut}>Sign out</button>
            </span>
            {courses.length > 0 && (
              <label>
                Course{' '}
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  {courses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {course && (
            <p className="course-title">
              {course.code}: {course.title} <span className="muted">{course.term}</span>
            </p>
          )}

          <nav className="tabs">
            <button className={page === 'matches' ? 'tab active' : 'tab'} onClick={() => setPage('matches')}>
              Matches
            </button>
            <button className={page === 'requests' ? 'tab active' : 'tab'} onClick={() => setPage('requests')}>
              Requests
            </button>
            <button className={page === 'group' ? 'tab active' : 'tab'} onClick={() => setPage('group')}>
              Group
            </button>
            <button className={page === 'profile' ? 'tab active' : 'tab'} onClick={() => setPage('profile')}>
              My profile
            </button>
            <button className={page === 'account' ? 'tab active' : 'tab'} onClick={() => setPage('account')}>
              Account
            </button>
          </nav>

          <main>
            {courses.length === 0 && <p className="muted">There are no courses to pick from yet.</p>}
            {course && page === 'matches' && (
              <CandidatesPage studentId={me.studentId} courseId={courseId} studentName={me.name} />
            )}
            {course && page === 'requests' && <RequestsPage studentId={me.studentId} courseId={courseId} />}
            {course && page === 'group' && <GroupPage studentId={me.studentId} courseId={courseId} />}
            {course && page === 'profile' && <ProfilePage courseId={courseId} />}
            {page === 'account' && <AccountPage me={me} />}
          </main>

          {(!me.tutorialCompleted || helpOpen) && (
            <TutorialDialog
              replay={me.tutorialCompleted}
              onDone={() => {
                setMe({ ...me, tutorialCompleted: true });
                setHelpOpen(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
