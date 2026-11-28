// collaborative code by the group and claude sonnet 5.5
// some parts are original code by swap, written by hand

import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { CandidateSummary, Id, RequestRecord } from '../types/api';
import { CandidateCard } from '../components/CandidateCard';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retryable: boolean }
  | { kind: 'ready'; candidates: CandidateSummary[]; requests: RequestRecord[] };

export function CandidatesPage({ studentId, courseId, studentName }: { studentId: Id; courseId: Id; studentName: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // card whose request is in flight, and any problem with it
  const [busyId, setBusyId] = useState<Id | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    // requests only mark cards that have one, list still shows if they fail to load
    Promise.all([api.getCandidates(courseId), api.getRequests(courseId).catch(() => ({ requests: [] }))])
      .then(([res, reqs]) => !cancelled && setState({ kind: 'ready', candidates: res.candidates, requests: reqs.requests }))
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError) {
          // CONFLICT messages are worded for the user, network problems are worth a retry
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

  // newest request per candidate comes first
  function latestRequest(requests: RequestRecord[], candidateId: Id) {
    return requests.find((r) => r.requesterId === candidateId || r.recipientId === candidateId);
  }

  // swap one request in the list so the card updates without a reload
  function updateRequest(updated: RequestRecord) {
    setState((current) => {
      if (current.kind !== 'ready') return current;
      const others = current.requests.filter((r) => r.requestId !== updated.requestId);
      return { ...current, requests: [updated, ...others] };
    });
  }

  async function handleSend(candidateId: Id) {
    setBusyId(candidateId);
    setActionError(null);
    try {
      updateRequest(await api.sendRequest(courseId, candidateId));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(candidateId: Id, requestId: Id) {
    setBusyId(candidateId);
    setActionError(null);
    try {
      updateRequest(await api.cancelRequest(requestId));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

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

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {state.kind === 'ready' && state.candidates.length > 0 && (
        <ol className="cards">
          {state.candidates.map((c, i) => (
            <CandidateCard
              key={c.candidateId}
              candidate={c}
              rank={i + 1}
              studentId={studentId}
              request={latestRequest(state.requests, c.candidateId)}
              busy={busyId === c.candidateId}
              onSend={() => handleSend(c.candidateId)}
              onCancel={(requestId) => handleCancel(c.candidateId, requestId)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

// srs ud-1: explains the list order (matches matching/pipeline.ts)
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
