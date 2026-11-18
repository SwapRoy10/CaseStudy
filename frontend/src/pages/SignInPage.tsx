import { FormEvent, useEffect, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { DemoCourse, Me } from '../types/api';

export function SignInPage({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // the demo roster is only there outside production. if the call fails the
  // picker just isn't shown and the password form is all you get.
  const [roster, setRoster] = useState<DemoCourse[]>([]);
  const [demoCourseId, setDemoCourseId] = useState('');
  const [demoStudentId, setDemoStudentId] = useState('');

  useEffect(() => {
    api
      .getDemoRoster()
      .then((res) => {
        setRoster(res.courses);
        // start in csds 393 since that's the real class
        const start = res.courses.find((c) => c.code === 'CSDS 393') ?? res.courses[0];
        if (start) pickCourse(start);
      })
      .catch(() => setRoster([]));
  }, []);

  // switching course also switches to someone on that roster who has a profile
  function pickCourse(course: DemoCourse) {
    setDemoCourseId(course.id);
    const first = course.students.find((s) => s.hasProfile) ?? course.students[0];
    setDemoStudentId(first ? first.id : '');
  }

  async function handleDemoSignIn() {
    setBusy(true);
    setError(null);
    try {
      await api.demoSignIn(demoStudentId);
      onSignedIn(await api.getMe());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signIn(email, password);
      onSignedIn(await api.getMe());
    } catch (err) {
      // the backend words these for the student, like "Email or password is incorrect."
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="signin">
      <h2>Sign in</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">School email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="save-btn" type="submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {roster.length > 0 && (
        <div className="demo-picker">
          <h3>Demo</h3>
          <p className="muted">Pick a student from the demo class list to sign in as them, no password needed.</p>
          <div className="form-field">
            <label htmlFor="demo-course">Course</label>
            <select
              id="demo-course"
              value={demoCourseId}
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
          </div>
          <div className="form-field">
            <label htmlFor="demo-student">Student</label>
            <select id="demo-student" value={demoStudentId} onChange={(e) => setDemoStudentId(e.target.value)}>
              {roster
                .find((c) => c.id === demoCourseId)
                ?.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.hasProfile ? '' : ' (no profile yet)'}
                  </option>
                ))}
            </select>
          </div>
          <button onClick={handleDemoSignIn} disabled={busy || !demoStudentId}>
            Sign in as this student
          </button>
          <p className="muted">Or use a demo email like mxc1001@case.edu with the password casestudy123.</p>
        </div>
      )}
    </section>
  );
}
