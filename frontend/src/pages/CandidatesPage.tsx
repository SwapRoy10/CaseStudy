import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { CandidateSummary, Id } from '../types/api';
import { CandidateCard } from '../components/CandidateCard';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retryable: boolean }
  | { kind: 'ready'; candidates: CandidateSummary[] };

export function CandidatesPage({ studentId, courseId }: { studentId: Id; courseId: Id }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    api
      .getCandidates(courseId)
      .then((res) => !cancelled && setState({ kind: 'ready', candidates: res.candidates }))
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError) {
          // STATE_CONFLICT messages (e.g. NO_PROFILE) are written for the user.
          // Network/server problems are worth retrying; conflicts aren't.
          const retryable = err.code === 'NETWORK' || err.code === 'UNAVAILABLE';
          setState({ kind: 'error', message: err.message, retryable });
        } else {
          setState({ kind: 'error', message: 'Something went wrong.', retryable: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, courseId, attempt]);

  return (
    <section>
      <h2>Study partner candidates</h2>

      {state.kind === 'loading' && <p className="muted">Finding classmates…</p>}

      {state.kind === 'error' && (
        <div className="notice" role="alert">
          <p>{state.message}</p>
          {state.retryable && <button onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
        </div>
      )}

      {state.kind === 'ready' && state.candidates.length === 0 && (
        <p className="muted">No matches yet. Try adding more free time to your profile.</p>
      )}

      {state.kind === 'ready' && state.candidates.length > 0 && (
        <ol className="cards">
          {state.candidates.map((c, i) => (
            <CandidateCard key={c.candidateId} candidate={c} rank={i + 1} />
          ))}
        </ol>
      )}
    </section>
  );
}
