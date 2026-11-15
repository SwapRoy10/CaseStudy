import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { CandidateSummary, Id } from '../types/api';
import { CandidateCard } from '../components/CandidateCard';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retryable: boolean }
  | { kind: 'ready'; candidates: CandidateSummary[] };

export function CandidatesPage({ studentId, courseId, studentName }: { studentId: Id; courseId: Id; studentName: string }) {
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
          // CONFLICT messages (e.g. NO_PROFILE) are written for the user.
          // network or server problems are worth retrying, conflicts aren't.
          const retryable = ['NETWORK', 'UNAVAILABLE', 'RATE_LIMITED'].includes(err.code);
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
      <h2>Study partners for {studentName}</h2>

      <HowMatchingWorks />

      {state.kind === 'loading' && <p className="muted">Finding classmates...</p>}

      {state.kind === 'error' && (
        <div className="notice" role="alert">
          <p>{state.message}</p>
          {state.retryable && <button onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
        </div>
      )}

      {state.kind === 'ready' && state.candidates.length === 0 && (
        <p className="muted">
          No classmates currently meet both criteria: the same grade goal and at least one shared free time.
          Adding more free time to your profile can help.
        </p>
      )}

      {state.kind === 'ready' && state.candidates.length > 0 && (
        <p className="muted">
          {state.candidates.length} {state.candidates.length === 1 ? 'classmate matches' : 'classmates match'}, best match first
        </p>
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

// srs ud-1: tell students how the list is put together. same order as the
// matching code in backend/src/matching/pipeline.ts
function HowMatchingWorks() {
  return (
    <details className="rules">
      <summary>How matches are picked</summary>
      <ol>
        <li>Only classmates with the same grade goal as you.</li>
        <li>Only classmates who share at least one free time with you.</li>
        <li>More shared time slots ranks higher.</li>
        <li>If that's a tie, classmates with your work style come first.</li>
        <li>Anyone still tied is put in random order.</li>
      </ol>
      <p className="muted">Review ratings are shown but never change the order.</p>
    </details>
  );
}
