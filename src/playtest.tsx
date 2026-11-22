import { useState } from 'react';
import type { Result } from './engine/scoring.ts';
import type { Mode } from './session.ts';

export function Playtest({ ranking, mode }: { ranking: Result[]; mode: Mode }) {
  const [message, setMessage] = useState('');
  return <details className="full-ranking">
    <summary>Record a playtest session</summary>
    <form className="playtest" onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const participant = String(form.get('participant')).trim().toLowerCase();
      if (!/^[a-z0-9-]{2,32}$/.test(participant)) {
        setMessage('Use a 2–32 character code with letters, numbers, or dashes.');
        return;
      }
      const data = {
        version: 1, participant, date: new Date().toISOString().slice(0, 10), mode,
        session: Number(form.get('session')), faceValidity: Number(form.get('face')),
        top: ranking.map(result => result.aesthetic.slug),
      };
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      link.download = `profiler-playtest-${participant}-${data.session}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setMessage('Playtest record downloaded.');
    }}>
      <label>Participant code<input name="participant" required maxLength={32} placeholder="e.g. tester-07" /></label>
      <label>Session<select name="session"><option value="1">First intake</option><option value="2">Retest</option></select></label>
      <label>How well does #1 fit your taste?<select name="face" required defaultValue="">
        <option value="" disabled>Choose a rating</option>
        <option value="1">1 / Very poorly</option><option value="2">2 / Poorly</option>
        <option value="3">3 / Somewhat</option><option value="4">4 / Well</option><option value="5">5 / Very well</option>
      </select></label>
      <button className="button" type="submit">Download playtest record</button>
      <p role="status">{message}</p>
    </form>
  </details>;
}
