import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../services/api';
import type { AvailabilityBlock, GradeGoal, Id, WorkStyle } from '../types/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// turns 600 into "10:00"
function toTime(minutes: number) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// turns "10:00" into 600
function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

const NEW_BLOCK: AvailabilityBlock = { weekday: 1, startMinute: 600, endMinute: 660 };

export function ProfilePage({ courseId }: { courseId: Id }) {
  // empty means not chosen yet, so a missing field can be pointed out (srs profile.missingfields)
  const [gradeGoal, setGradeGoal] = useState<GradeGoal | ''>('');
  const [workStyle, setWorkStyle] = useState<WorkStyle | ''>('');
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([NEW_BLOCK]);
  const [average, setAverage] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the fields the server said were missing or bad
  const [badFields, setBadFields] = useState<string[]>([]);

  // load what is already saved for this course
  useEffect(() => {
    setLoading(true);
    setSaved(false);
    setError(null);
    setBadFields([]);

    api
      .getProfile(courseId)
      .then((p) => {
        // null means nothing is saved for this course yet
        setGradeGoal(p ? p.gradeGoal : '');
        setWorkStyle(p ? p.workStyle : '');
        setBlocks(p && p.blocks.length > 0 ? p.blocks : [NEW_BLOCK]);
        setAverage(p ? p.reviewAverage : null);
      })
      .catch((err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  function updateBlock(index: number, changes: Partial<AvailabilityBlock>) {
    setBlocks(blocks.map((b, i) => (i === index ? { ...b, ...changes } : b)));
    setSaved(false);
  }

  function addBlock() {
    setBlocks([...blocks, NEW_BLOCK]);
    setSaved(false);
  }

  function removeBlock(index: number) {
    setBlocks(blocks.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function handleSave() {
    setSaved(false);
    setBadFields([]);

    if (blocks.some((b) => b.endMinute <= b.startMinute)) {
      setError('Each end time must be after its start time.');
      return;
    }

    try {
      const p = await api.saveProfile(courseId, { gradeGoal, workStyle, blocks });
      // the server merges overlapping times, so show what it kept
      setBlocks(p.blocks.length > 0 ? p.blocks : blocks);
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

  return (
    <section>
      <h2>My profile</h2>
      <p className="muted">Tell us how you like to study. We use this to find your matches.</p>
      <p className="muted">Your review average: {average === null ? 'Not yet rated' : `${average.toFixed(1)} out of 5`}</p>

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
          <option value="">Choose one</option>
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
          <option value="">Choose one</option>
          <option value="GROUP">Prefers group work</option>
          <option value="SOLO">Prefers solo work</option>
        </select>
        {isBad('workStyle') && <span className="field-error">Pick a work style.</span>}
      </div>

      <fieldset className="availability">
        <legend>Weekly free time</legend>

        {blocks.map((block, i) => (
          <div className="block-row" key={i}>
            <select
              aria-label="Day"
              value={block.weekday}
              onChange={(e) => updateBlock(i, { weekday: Number(e.target.value) })}
            >
              {DAYS.map((day, n) => (
                <option key={day} value={n}>
                  {day}
                </option>
              ))}
            </select>

            <input
              type="time"
              aria-label="Start time"
              value={toTime(block.startMinute)}
              onChange={(e) => e.target.value && updateBlock(i, { startMinute: toMinutes(e.target.value) })}
            />
            <span>to</span>
            <input
              type="time"
              aria-label="End time"
              value={toTime(block.endMinute)}
              onChange={(e) => e.target.value && updateBlock(i, { endMinute: toMinutes(e.target.value) })}
            />

            <button onClick={() => removeBlock(i)}>Remove</button>
          </div>
        ))}

        <button onClick={addBlock}>+ Add time slot</button>
        {isBad('blocks') && <span className="field-error">Add at least one free time slot.</span>}
      </fieldset>

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
