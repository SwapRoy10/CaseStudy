import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { GroupView, Id, RequestRecord } from '../types/api';
import { MatchedProfile } from '../components/MatchedProfile';
import { ReviewForm } from '../components/ReviewForm';

// confirmed group for this course (sdd 6.1), profiles and reviews per member
export function GroupPage({ studentId, courseId }: { studentId: Id; courseId: Id }) {
  const [group, setGroup] = useState<GroupView | null>(null);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // member whose profile or review form is open
  const [profileOf, setProfileOf] = useState<Id | null>(null);
  const [reviewOf, setReviewOf] = useState<Id | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setProfileOf(null);
    setReviewOf(null);

    Promise.all([api.getGroup(courseId), api.getRequests(courseId)])
      .then(([g, r]) => {
        setGroup(g.group);
        setRequests(r.requests);
      })
      .catch((err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  // accepted request with this member, either direction
  function isMatched(memberId: Id) {
    return requests.some(
      (r) =>
        r.status === 'ACCEPTED' &&
        ((r.requesterId === studentId && r.recipientId === memberId) || (r.requesterId === memberId && r.recipientId === studentId))
    );
  }

  // mark the member reviewed without a reload
  function markReviewed(memberId: Id) {
    setGroup((current) =>
      current
        ? { ...current, members: current.members.map((m) => (m.studentId === memberId ? { ...m, reviewedByMe: true } : m)) }
        : current
    );
  }

  if (loading) return <p className="muted">Loading your group...</p>;

  if (error) {
    return (
      <div className="notice" role="alert">
        <p>{error}</p>
      </div>
    );
  }

  if (!group) {
    return (
      <section>
        <h2>Your group</h2>
        <p className="muted">
          You are not in a group for this course yet. A group forms when a classmate accepts your request, or when you
          accept theirs.
        </p>
      </section>
    );
  }

  const others = group.members.filter((m) => m.studentId !== studentId);

  return (
    <section>
      <h2>Your group</h2>
      <p className="muted">Formed {new Date(group.formedAt).toLocaleDateString()}. {group.members.length} members.</p>

      <ul className="cards">
        {others.map((m) => (
          <li className="card" key={m.studentId}>
            <div className="card-head">
              <span>{m.name}</span>
              <span className="rating">{m.reviewedByMe ? 'Reviewed' : 'Not reviewed yet'}</span>
            </div>

            <p className="actions">
              {isMatched(m.studentId) && (
                <button onClick={() => setProfileOf(profileOf === m.studentId ? null : m.studentId)}>
                  {profileOf === m.studentId ? 'Hide profile' : 'View full profile'}
                </button>
              )}
              <button onClick={() => setReviewOf(reviewOf === m.studentId ? null : m.studentId)}>
                {reviewOf === m.studentId ? 'Close review' : 'Peer review'}
              </button>
            </p>

            {profileOf === m.studentId && <MatchedProfile courseId={courseId} studentId={m.studentId} />}
            {reviewOf === m.studentId && (
              <ReviewForm groupId={group.groupId} member={m} criteria={group.criteria} onReviewed={markReviewed} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
