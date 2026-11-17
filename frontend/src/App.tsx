import { useEffect, useState } from 'react';
import { api, ApiRequestError, setSignedOutHandler } from './services/api';
import type { Id, Me, MyCourse } from './types/api';
import { ConnectionStatus } from './components/ConnectionStatus';
import { CandidatesPage } from './pages/CandidatesPage';
import { ProfilePage } from './pages/ProfilePage';
import { SignInPage } from './pages/SignInPage';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  // true until the first answer from /api/me, so the sign in screen doesn't flash
  const [checking, setChecking] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<Id>('');
  const [page, setPage] = useState<'matches' | 'profile'>('matches');

  // a 401 from any call means the session ended, so go back to the sign in screen
  useEffect(() => {
    setSignedOutHandler(() => setMe(null));
    return () => setSignedOutHandler(null);
  }, []);

  // someone may already be signed in, since the cookie survives a page reload
  useEffect(() => {
    api
      .getMe()
      .then(start)
      .catch((err: unknown) => {
        // 401 just means nobody is signed in yet, anything else is a real problem
        if (!(err instanceof ApiRequestError) || err.status !== 401) {
          setStartError(err instanceof Error ? err.message : 'Something went wrong.');
        }
      })
      .finally(() => setChecking(false));
  }, []);

  function start(student: Me) {
    setMe(student);
    setPage('matches');
    // start in csds 393 since that's the real class
    const first = student.courses.find((c) => c.code === 'CSDS 393') ?? student.courses[0];
    setCourseId(first ? first.id : '');
  }

  async function handleSignOut() {
    // the cookie is cleared by the server, but if the call fails we still leave
    await api.signOut().catch(() => null);
    setMe(null);
  }

  const course: MyCourse | undefined = me?.courses.find((c) => c.id === courseId);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>CaseStudy</h1>
          <p className="muted">Find study partners in your course</p>
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
              <button onClick={handleSignOut}>Sign out</button>
            </span>
            {me.courses.length > 0 && (
              <label>
                Course{' '}
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  {me.courses.map((c) => (
                    <option key={c.id} value={c.id}>
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
            <button className={page === 'profile' ? 'tab active' : 'tab'} onClick={() => setPage('profile')}>
              My profile
            </button>
          </nav>

          <main>
            {me.courses.length === 0 && (
              <p className="muted">You are not on the roster of any course yet.</p>
            )}
            {course && page === 'matches' && (
              <CandidatesPage studentId={me.studentId} courseId={courseId} studentName={me.name} />
            )}
            {course && page === 'profile' && <ProfilePage />}
          </main>
        </>
      )}
    </div>
  );
}
