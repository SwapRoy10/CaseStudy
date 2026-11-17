import { useState } from 'react';
import { api } from '../services/api';

// first time pop up (srs ud-2). the practice card is only on this screen, nothing
// you do here is saved.
export function TutorialDialog({ onDone }: { onDone: () => void }) {
  const [practiced, setPracticed] = useState(false);

  async function handleDone() {
    // if this call fails the pop up just shows again next time, so don't block on it
    await api.completeTutorial().catch(() => null);
    onDone();
  }

  return (
    <div className="tutorial-backdrop">
      <div className="tutorial" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <h2 id="tutorial-title">Welcome to CaseStudy</h2>
        <ol>
          <li>Fill in your profile: your grade goal, how you like to work, and when you are free each week.</li>
          <li>Open Matches to see classmates ranked by how much free time you share.</li>
          <li>Send a request. When they accept, you get a group and can see their full profile.</li>
          <li>After you work together, rate your groupmates from the Group tab.</li>
        </ol>

        <p className="label">Try it</p>
        <div className="card">
          <p className="tags">
            <span>Aiming for an A</span>
            <span>Prefers group work</span>
          </p>
          <p className="muted">Shared free time: Mon 10am to 11am</p>
          {practiced ? (
            <p className="request-sent">Request sent</p>
          ) : (
            <button className="request-btn" onClick={() => setPracticed(true)}>
              Request to study together
            </button>
          )}
        </div>
        <p className="muted">This is a practice card, nothing here is saved.</p>

        <button className="save-btn" onClick={handleDone}>
          Got it
        </button>
      </div>
    </div>
  );
}
