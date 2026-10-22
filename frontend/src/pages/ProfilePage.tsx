import { useState } from 'react';
import type { GradeGoal, WorkStyle } from '../types/api';

export function ProfilePage() {
  const [gradeGoal, setGradeGoal] = useState<GradeGoal>('A_TRACK');
  const [workStyle, setWorkStyle] = useState<WorkStyle>('GROUP');
  const [saved, setSaved] = useState(false);

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

      <button className="save-btn" onClick={handleSave}>
        Save profile
      </button>
      {saved && <p className="request-sent">Profile saved ✓</p>}
    </section>
  );
}