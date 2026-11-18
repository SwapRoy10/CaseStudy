import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { GradeGoal, Id, WorkStyle } from '../types/api';
import { toBlocks, toCells } from '../availability';
import type { Cells } from '../availability';
import { AvailabilityGrid } from '../components/AvailabilityGrid';

export function ProfilePage({ courseId }: { courseId: Id }) {
  // empty means not chosen yet, so a missing field can be pointed out (srs profile.missingfields)
  const [gradeGoal, setGradeGoal] = useState<GradeGoal | ''>('');
  const [workStyle, setWorkStyle] = useState<WorkStyle | ''>('');
  const [cells, setCells] = useState<Cells>(new Set());
  const [average, setAverage] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // not on this course's roster, so there is no profile to show or save
  const [notEnrolled, setNotEnrolled] = useState(false);
  // the fields the server said were missing or bad
  const [badFields, setBadFields] = useState<string[]>([]);

  // load what is already saved for this course
  useEffect(() => {
    setLoading(true);
    setSaved(false);
    setError(null);
    setNotEnrolled(false);
    setBadFields([]);

    api
      .getProfile(courseId)
      .then((p) => {
        // null means nothing is saved for this course yet
        setGradeGoal(p ? p.gradeGoal : '');
        setWorkStyle(p ? p.workStyle : '');
        setCells(toCells(p ? p.blocks : []));
        setAverage(p ? p.reviewAverage : null);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.reason === 'NOT_ENROLLED') setNotEnrolled(true);
        setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  async function handleSave() {
    setSaved(false);
    setBadFields([]);

    try {
      const p = await api.saveProfile(courseId, { gradeGoal, workStyle, blocks: toBlocks(cells) });
      // the server merges overlapping times, so draw what it kept
      setCells(toCells(p.blocks));
      setAverage(p.reviewAverage);
      setError(null);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setBadFields(err.fields ?? []);
      } else {
        setError('Something went wrong.');
      }
    }
  }

  // blocks.0.startMinute and so on all count as the blocks field
  const isBad = (field: string) => badFields.some((f) => f === field || f.startsWith(`${field}.`));

  if (loading) return <p className="muted">Loading your profile...</p>;

  if (notEnrolled) {
    return (
      <section>
        <h2>My profile</h2>
        <p className="form-error" role="alert">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2>My profile</h2>
      <p className="muted">Your review average: {average === null ? 'Not yet rated' : `${average.toFixed(1)} out of 5`}</p>

      <div className="field-row">
        <div className="form-field">
          <label htmlFor="grade-goal">Grade goal</label>
          <select
            id="grade-goal"
            value={gradeGoal}
            onChange={(e) => {
              setGradeGoal(e.target.value as GradeGoal | '');
              setSaved(false);
            }}
          >
            <option value="" disabled>Choose one</option>
            <option value="A_TRACK">Aiming for an A</option>
            <option value="PASS_TRACK">Aiming to pass</option>
          </select>
          {isBad('gradeGoal') && <span className="field-error">Pick a grade goal.</span>}
        </div>

        <div className="form-field">
          <label htmlFor="work-style">Work style</label>
          <select
            id="work-style"
            value={workStyle}
            onChange={(e) => {
              setWorkStyle(e.target.value as WorkStyle | '');
              setSaved(false);
            }}
          >
            <option value="" disabled>Choose one</option>
            <option value="GROUP">Prefers group work</option>
            <option value="SOLO">Prefers solo work</option>
          </select>
          {isBad('workStyle') && <span className="field-error">Pick a work style.</span>}
        </div>
      </div>

      <div className="form-field wide">
        <span className="field-label">Weekly free time</span>
        <AvailabilityGrid
          cells={cells}
          onChange={(next) => {
            setCells(next);
            setSaved(false);
          }}
        />
        {isBad('blocks') && <span className="field-error">Mark at least one free time.</span>}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button className="save-btn" onClick={handleSave}>
        Save profile
      </button>
      {saved && <p className="request-sent">Profile saved</p>}
    </section>
  );
}
