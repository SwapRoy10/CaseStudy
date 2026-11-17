import { FormEvent, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { Me } from '../types/api';

export function AccountPage({ me }: { me: Me }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setDone(false);

    if (next.length < 8) {
      setError('The new password has to be at least 8 characters.');
      return;
    }
    if (next !== again) {
      setError('The two new passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setAgain('');
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Account</h2>
      <p className="muted">
        Signed in as {me.name}. Passwords from a class roster start out random, so change yours here.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="current-password">Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="again-password">New password again</label>
          <input id="again-password" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="save-btn" type="submit" disabled={busy}>
          {busy ? 'Saving...' : 'Change password'}
        </button>
        {done && <p className="request-sent">Password changed</p>}
      </form>
    </section>
  );
}
