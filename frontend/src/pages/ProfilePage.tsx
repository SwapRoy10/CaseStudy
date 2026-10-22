import { useState } from 'react';
import type { AvailabilityBlock, GradeGoal, WorkStyle } from '../types/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// 600 -> "10:00"
function toTime(minutes: number) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// "10:00" -> 600
function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

const NEW_BLOCK: AvailabilityBlock = { weekday: 1, startMinute: 600, endMinute: 660 };


export function ProfilePage() {
  const [gradeGoal, setGradeGoal] = useState<GradeGoal>('A_TRACK');
  const [workStyle, setWorkStyle] = useState<WorkStyle>('GROUP');
  const [saved, setSaved] = useState(false);

  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([NEW_BLOCK]);
  const [error, setError] = useState<string | null>(null);


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



  function handleSave() {
    // TODO: send the profile to the backend once the profile endpoint exists
    setSaved(true);
  }

    return (
    <section>
      <h2>My profile</h2>
      <p className="muted">Tell us how you like to study. We use this to find your matches.</p>

      <div className="form-field">
        <label htmlFor="grade-goal">Grade goal</label>
        <select
          id="grade-goal"
          value={gradeGoal}
          onChange={(e) => {
            setGradeGoal(e.target.value as GradeGoal);
            setSaved(false);
          }}
        >
          <option value="A_TRACK">Aiming for an A</option>
          <option value="PASS_TRACK">Aiming to pass</option>
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="work-style">Work style</label>
        <select
          id="work-style"
          value={workStyle}
          onChange={(e) => {
            setWorkStyle(e.target.value as WorkStyle);
            setSaved(false);
          }}
        >
          <option value="GROUP">Prefers group work</option>
          <option value="SOLO">Prefers solo work</option>
        </select>
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
      </fieldset>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="save-btn" onClick={handleSave}>
        Save profile
      </button>
      {saved && <p className="request-sent">Profile saved ✓</p>}
    </section>
  );

}