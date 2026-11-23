import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { axes, styles } from './data.ts';
import { buildUserVector, explain, rank, scoreAesthetics, ties, type Answers, type Profile, type Question, type Result } from './engine/scoring.ts';
import { bank, shareUrl, type Mode } from './session.ts';
import { resultTheme } from './theme.ts';
import { Playtest } from './playtest.tsx';
import { CompareProfiles, ExploreCatalog } from './explore.tsx';

const clean = (text: string) => text.replace(/\s+/g, ' ');

function ResultCard({ result, position, avoid, explanations }: {
  result: Result; position: number; avoid?: boolean; explanations: string[];
}) {
  const { aesthetic, match } = result;
  return <article className={`result-card ${avoid ? 'avoid' : ''}`}>
    <div className="card-meta"><span>{String(position).padStart(2, '0')}</span><span>{match}% match</span></div>
    <h3>{aesthetic.name}</h3>
    <p>{aesthetic.summary}</p>
    {aesthetic.timeline && <p className="result-era">{aesthetic.timeline}</p>}
    <ul className="motif-tags" aria-label="Key motifs">
      {aesthetic.signature_motifs.slice(0, 6).map(motif => <li key={motif}>{motif}</li>)}
    </ul>
    <div className="explanations">
      <h4>{avoid ? 'Why you’d avoid it' : 'Why you matched'}</h4>
      {explanations.length ? <ul>{explanations.map(line => <li key={line}>{line}</li>)}</ul>
        : <p>Results reflect your combined answers.</p>}
    </div>
    <a className="source" href={aesthetic.url}>Source: CARI <span aria-hidden="true">↗</span></a>
  </article>;
}

function Radar({ profile, theme, textOnly }: { profile: Profile; theme: ReturnType<typeof resultTheme>; textOnly: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const values = axes.map(axis => Math.max(-1, Math.min(1, (profile.vector[axis.id] ?? 0) / 3)));
  useEffect(() => {
    if (textOnly) return;
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const center = 200;
    const radius = 129;
    const angle = (index: number) => -Math.PI / 2 + index * Math.PI * 2 / values.length;
    const point = (index: number, scale: number) =>
      [center + Math.cos(angle(index)) * radius * scale, center + Math.sin(angle(index)) * radius * scale] as const;
    function polygon(scales: number[]) {
      context!.beginPath();
      scales.forEach((scale, index) => {
        if (index) context!.lineTo(...point(index, scale));
        else context!.moveTo(...point(index, scale));
      });
      context!.closePath();
    }
    context.clearRect(0, 0, 400, 400);
    context.lineWidth = 1;
    context.strokeStyle = theme.accent;
    context.globalAlpha = 0.32;
    for (const ring of [0.25, 0.5, 0.75, 1]) {
      polygon(values.map(() => ring));
      context.stroke();
    }
    axes.forEach((_, index) => {
      context.beginPath();
      context.moveTo(center, center);
      context.lineTo(...point(index, 1));
      context.stroke();
    });
    polygon(values.map(value => (value + 1) / 2));
    context.fillStyle = theme.accent;
    context.fill();
    context.globalAlpha = 1;
    context.lineWidth = 2;
    context.stroke();
    context.font = '12px ui-monospace, monospace';
    context.fillStyle = theme.ink;
    context.textAlign = 'center';
    axes.forEach((axis, index) => context.fillText(axis.id, ...point(index, 1.24)));
  }, [profile, theme.accent, theme.ink, textOnly, values]);
  return <div className="radar-layout">
    {!textOnly && <canvas ref={canvas} width="400" height="400" role="img"
      aria-label="Radar chart of ten taste axes. The accompanying table gives the values." />}
    <table className="axis-table">
      <thead><tr><th scope="col">Axis</th><th scope="col">Preference</th></tr></thead>
      <tbody>{axes.map(({ id, negative, positive }, i) => {
        const n = values[i];
        const direction = n < 0 ? negative : positive;
        return <tr key={id}><th scope="row">{negative} / {positive}</th>
          <td>{!profile.exposures[id] ? 'No answer' : Math.abs(n) < 0.035 ? 'Neutral' : `${direction} · ${Math.round(Math.abs(n) * 100)}%`}</td></tr>;
      })}</tbody>
    </table>
  </div>;
}

async function downloadCard(top: Result[], bottom: Result[], theme: ReturnType<typeof resultTheme>) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 825;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas export is unavailable');
  ctx.fillStyle = theme.paper;
  ctx.fillRect(0, 0, 1200, 825);
  ctx.fillStyle = theme.soft;
  ctx.fillRect(35, 35, 1130, 755);
  ctx.fillStyle = theme.ink;
  ctx.font = '22px monospace';
  ctx.fillText('AESTHETIC AFFINITY PROFILER', 75, 95);
  ctx.font = `bold 83px ${theme.font}`;
  ctx.fillText('Accession card', 70, 203, 1060);
  ctx.font = '24px monospace';
  ctx.fillStyle = theme.accent;
  ctx.fillText('CLOSEST MATCHES', 75, 295);
  ctx.fillText('LOWEST AFFINITY', 650, 295);
  const print = (items: Result[], x: number) => {
    if (!items.length) {
      ctx.fillStyle = theme.ink;
      ctx.font = '20px monospace';
      ctx.fillText('Insufficient evidence', x, 377);
    }
    items.forEach(({ aesthetic, match }, index) => {
      const y = 372 + index * 91;
      ctx.fillStyle = theme.ink;
      ctx.font = `bold 33px ${theme.font}`;
      ctx.fillText(clean(aesthetic.name), x, y, 475);
      ctx.fillStyle = theme.accent;
      ctx.font = '21px monospace';
      ctx.fillText(`${index + 1} / ${match}% match`, x, y + 30);
    });
  };
  print(top, 75);
  print(bottom, 650);
  ctx.fillStyle = theme.ink;
  ctx.font = '20px monospace';
  ctx.fillText('Catalog: CARI · cari.institute/aesthetics', 75, 738);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('Unable to export the card')), 'image/png'));
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = 'aesthetic-affinity-accession-card.png';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function ResultView({ mode, answers, duels, textOnly, heading, retake }: {
  mode: Mode; answers: Answers; duels: Question[]; textOnly: boolean;
  heading: RefObject<HTMLHeadingElement | null>; retake: () => void;
}) {
  const [message, setMessage] = useState('');
  const [share, setShare] = useState('');
  const computed = useMemo(() => {
    const questions = [...bank('full'), ...duels];
    const profile = buildUserVector(questions, answers);
    const ranking = rank(scoreAesthetics(profile, styles));
    return { profile, ranking, questions };
  }, [mode, duels, answers]);
  const { ranking, profile, questions } = computed;
  const theme = resultTheme(ranking.top[0]?.aesthetic);
  const topTies = ties(ranking.topPool);
  const bottomTies = ties(ranking.bottomPool);
  const themeStyle = {
    '--result-paper': theme.paper, '--result-ink': theme.ink, '--result-accent': theme.accent,
    '--result-soft': theme.soft, '--result-font': theme.font,
  } as CSSProperties;
  return <main className={`results pattern-${theme.motif}`} style={themeStyle}>
    <div className="result-header">
      <p className="kicker">Accession record / {mode === 'full' ? 'Full intake' : 'Quick intake'}</p>
      <h1 ref={heading} tabIndex={-1}>Your aesthetic profile</h1>
      <p>Your closest CARI match is <strong>{ranking.top[0]?.aesthetic.name}</strong>.</p>
      <div className="result-actions">
        <button className="button" onClick={async () => {
          try { await downloadCard(ranking.top, ranking.bottom, theme); setMessage('Accession card downloaded.'); }
          catch { setMessage('The accession card could not be downloaded.'); }
        }}>Download accession card</button>
        <button className="button secondary" onClick={async () => {
          const url = shareUrl(mode, answers, duels);
          setShare(url);
          try { await navigator.clipboard.writeText(url); setMessage('Results link copied.'); }
          catch { setMessage('Copy the results link below.'); }
        }}>Share results</button>
        <button className="button text-button" onClick={retake}>Retake quiz</button>
      </div>
      {share && <label className="share-field">Results URL<input type="url" value={share} readOnly
        onFocus={event => event.currentTarget.select()} /></label>}
      <p className="result-status" role="status">{message}</p>
    </div>
    <section className="result-section">
      <div className="section-heading"><h2>Closest matches</h2><span>Top 3</span></div>
      {topTies.length > 0 && <p className="tie-note">Third place tied with {topTies.join(', ')}.</p>}
      <div className="result-grid">{ranking.top.map((result, index) => <ResultCard key={result.aesthetic.slug}
        result={result} position={index + 1} explanations={explain(questions, answers, result.aesthetic)} />)}</div>
    </section>
    <section className="result-section">
      <div className="section-heading"><h2>Lowest affinity</h2><span>Bottom 3</span></div>
      {bottomTies.length > 0 && <p className="tie-note">Third place tied with {bottomTies.join(', ')}.</p>}
      {ranking.bottom.length < 3 && <p className="tie-note">There wasn’t enough evidence for {3 - ranking.bottom.length} of the lowest-affinity slots.</p>}
      <div className="result-grid">{ranking.bottom.map((result, index) => <ResultCard key={result.aesthetic.slug}
        result={result} position={index + 1} avoid explanations={explain(questions, answers, result.aesthetic, true)} />)}</div>
    </section>
    <section className="result-section">
      <div className="section-heading"><h2>Your taste dimensions</h2></div>
      <Radar profile={profile} theme={theme} textOnly={textOnly} />
    </section>
    <ExploreCatalog full={ranking.full} />
    <CompareProfiles original={ranking} />
    {new URLSearchParams(window.location.search).get('playtest') === '1' && <Playtest ranking={ranking.top} mode={mode} />}
  </main>;
}
