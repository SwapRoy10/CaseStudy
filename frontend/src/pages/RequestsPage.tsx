// collaborative code by somesh and claude sonnet 5.5

import { useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { Id, RequestRecord } from '../types/api';
import { SummaryDetails } from '../components/CandidateCard';

const STATUS_LABEL = { PENDING: 'Pending', ACCEPTED: 'Accepted', DECLINED: 'Declined', CANCELED: 'Canceled' };

function when(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// inbox and outbox (srs ui-4), polls every 30 seconds and after each action
export function RequestsPage({ studentId, courseId }: { studentId: Id; courseId: Id }) {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<Id | null>(null);

  // last seen state of each request, empty until first load
  const lastSeen = useRef<Map<Id, string> | null>(null);

  async function load() {
    try {
      const res = await api.getRequests(courseId);
      noticeChanges(res.requests);
      setRequests(res.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // compare with the last load, notice anything new or changed
  function noticeChanges(fresh: RequestRecord[]) {
    const before = lastSeen.current;
    lastSeen.current = new Map(fresh.map((r) => [r.requestId, r.status]));
    if (!before) return;

    const found: string[] = [];
    for (const r of fresh) {
      const old = before.get(r.requestId);
      const mine = r.requesterId === studentId;
      if (old === undefined && !mine) {
        found.push('You got a new match request.');
      } else if (old !== undefined && old !== r.status) {
        if (mine && r.status === 'ACCEPTED') found.push('A classmate accepted your request. You are in a group now, see the Group tab.');
        if (mine && r.status === 'DECLINED') found.push('A classmate declined your request.');
        if (!mine && r.status === 'CANCELED') found.push('A classmate canceled their request to you.');
      }
    }
    if (found.length > 0) setNotices((current) => [...found, ...current]);
  }

  useEffect(() => {
    lastSeen.current = null;
    setLoading(true);
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [courseId]);

  // answer or cancel, then refresh the list
  async function act(requestId: Id, action: () => Promise<unknown>) {
    setBusyId(requestId);
    setError(null);
    try {
      await action();
    } catch (err) {
      // conflicts like "already answered" are worded for the student
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
      await load();
    }
  }

  const received = requests.filter((r) => r.recipientId === studentId);
  const sent = requests.filter((r) => r.requesterId === studentId);
  const shown = tab === 'received' ? received : sent;

  return (
    <section>
      <h2>Match requests</h2>
      {notices.map((text, i) => (
        <div className="notice" role="status" key={`${i}-${text}`}>
          <p>{text}</p>
          <button onClick={() => setNotices((current) => current.filter((_, n) => n !== i))}>Dismiss</button>
        </div>
      ))}

      <nav className="tabs">
        <button className={tab === 'received' ? 'tab active' : 'tab'} onClick={() => setTab('received')}>
          Received ({received.length})
        </button>
        <button className={tab === 'sent' ? 'tab active' : 'tab'} onClick={() => setTab('sent')}>
          Sent ({sent.length})
        </button>
      </nav>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="muted">Loading requests...</p>}
      {!loading && shown.length === 0 && (
        <p className="muted">{tab === 'received' ? 'No requests have come in yet.' : 'You have not sent any requests yet.'}</p>
      )}

      <ol className="cards request-list">
        {shown.map((r) => (
          <li className="card" key={r.requestId}>
            <div className="card-head">
              <span>{tab === 'received' ? 'From a classmate' : 'To a classmate'}</span>
              <span className={`status-tag status-${r.status.toLowerCase()}`}>{STATUS_LABEL[r.status]}</span>
            </div>
            <p className="muted">Sent {when(r.requestedAt)}</p>

            {r.other ? <SummaryDetails summary={r.other} /> : <p className="muted">This classmate no longer matches your profile.</p>}

            {/* recipient answers, sender cancels, only while pending */}
            {r.status === 'PENDING' && tab === 'received' && (
              <p className="actions">
                <button className="request-btn" disabled={busyId === r.requestId} onClick={() => act(r.requestId, () => api.respondToRequest(r.requestId, 'ACCEPT'))}>
                  Accept
                </button>
                <button disabled={busyId === r.requestId} onClick={() => act(r.requestId, () => api.respondToRequest(r.requestId, 'DECLINE'))}>
                  Decline
                </button>
              </p>
            )}
            {r.status === 'PENDING' && tab === 'sent' && (
              <p className="actions">
                <button disabled={busyId === r.requestId} onClick={() => act(r.requestId, () => api.cancelRequest(r.requestId))}>
                  Cancel request
                </button>
              </p>
            )}
            {r.status === 'ACCEPTED' && <p className="request-sent">Matched. See the Group tab.</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
