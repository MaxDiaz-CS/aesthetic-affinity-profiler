import { Preview, Inspector, describeAnswer, visualHints } from './intake-tools.tsx';
import { useEffect, useRef, useState } from 'react';
import { previews, styles, questions } from './data.ts';
import { buildUserVector, cosine, pickDuel, pickNextQuestion, rank, scoreAesthetics, type Answer, type Answers, type Question } from './engine/scoring.ts';
import { ResultView } from './results.tsx';
import { bank, readDraft, readSession, shareUrl, type Mode } from './session.ts';

const sections: Record<string, string> = {
  A: 'Warm-up', B: 'Visual choices', C: 'Scenarios', D: 'Motif reactions', E: 'Preferences', F: 'Tie-breaks',
};

function Header({ textOnly, setTextOnly }: { textOnly: boolean; setTextOnly: (value: boolean) => void }) {
  return <header className="masthead">
    <a className="wordmark" href={window.location.pathname}><span className="archive-mark" aria-hidden="true"><i /><i /><i /></span> Aesthetic Affinity Profiler</a>
    <label className="text-mode"><input type="checkbox" checked={textOnly} onChange={event => setTextOnly(event.currentTarget.checked)} /> Text-only</label>
  </header>;
}

function Footer() {
  return <footer className="footer">
    <span>Not affiliated with CARI</span>
    <nav aria-label="CARI links">
      <a href="https://cari.institute/">CARI</a>
      <a href="https://cari.institute/attribution-guidelines">Attribution guidelines</a>
      <a href="https://donorbox.org/support-cari">Donate</a>
    </nav>
  </footer>;
}

function Intake({ start }: { start: (mode: Mode) => void }) {
  const draft = new URLSearchParams(window.location.search).get('quickDraft') === '1';
  return <main className="intake">
    <p className="kicker">Form 01 / Visual preferences</p>
    <div className="intake-head">
      <div>
        <h1>The Intake<br />Desk<span>.</span></h1>
        <p className="intro-copy">Find the visual styles you gravitate toward, and the ones you’d rather leave in the archive.</p>
      </div>
      <div className="intake-slip" aria-hidden="true">
        <div className="slip-top"><span>Intake record</span><span>Form 01</span></div>
        <div className="swatch-stack"><i /><i /><i /></div>
        <div className="slip-line" /><div className="slip-line short" />
        <div className="slip-bottom"><span>Subject</span><span>Visual affinity</span></div>
      </div>
    </div>
    <div className="mode-heading"><h2>Choose your intake</h2><span>Pick the length that suits you</span></div>
    <div className="mode-grid">
      <button className="mode-card primary" onClick={() => start('full')}>
        <span className="mode-meta">36 questions + tie-breaks</span>
        <strong>Full intake</strong><span>More visual choices and scenarios.</span>
        <span className="mode-action">Start full intake <span aria-hidden="true">↗</span></span>
      </button>
      <button className="mode-card" onClick={() => start(draft ? 'quick-draft' : 'quick')}>
        <span className="mode-meta">{draft ? '12 questions + up to 3 tie-breaks' : '15 questions + tie-breaks'}</span>
        <strong>Quick intake</strong><span>{draft ? 'Preview the shorter question bank.' : 'A shorter intake with all three visual motif grids.'}</span>
        <span className="mode-action">Start quick intake <span aria-hidden="true">↗</span></span>
      </button>
    </div>
    <p className="privacy-note">Based on the CARI index. Your answers stay in your browser unless you share a results link.</p>
  </main>;
}

function QuestionOptions({ question, value, change, textOnly }: {
  question: Question; value: Answer | undefined; change: (value: Answer) => void; textOnly: boolean;
}) {
  if (question.type === 'slider') {
    const current = typeof value === 'number' ? value : 0;
    const display = current === 0 ? 'Neutral' : `${Math.abs(current) === 2 ? 'Strongly' : 'Slightly'} ${question.options[current < 0 ? 0 : 1].label.toLowerCase()}`;
    return <div className="slider-card">
      {!textOnly && <div className="slider-images">{question.options.map(option =>
        <Preview key={option.label} id={option.image!} textOnly={false} />)}</div>}
      <div className="slider-ends"><span>{question.options[0].label}</span><span>{question.options[1].label}</span></div>
      <input aria-label={question.prompt} aria-valuetext={display} type="range" min="-2" max="2" step="1"
        value={current} onChange={event => change(Number(event.currentTarget.value))} />
      <output>{display}</output>
    </div>;
  }
  if (question.type === 'motif') {
    const votes = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return <>
      <div className="motif-grid">{question.options.map(option => {
        const id = option.motifs[0];
        return <div className="motif" key={id} role="group" aria-label={option.label}>
          {option.image && <Preview id={option.image} textOnly={textOnly} />}
          <strong>{option.label}</strong>
          <div className="vote-grid">{([1, -1] as const).map(vote =>
            <button type="button" key={vote} aria-pressed={votes[id] === vote}
              aria-label={`${vote > 0 ? 'Love' : 'Dislike'} ${option.label}`}
              onClick={() => change({ ...votes, [id]: votes[id] === vote ? 0 : vote })}>
              <span aria-hidden="true">{vote > 0 ? '♡' : '×'}</span> {vote > 0 ? 'Love' : 'Dislike'}
            </button>)}</div>
        </div>;
      })}</div>
    </>;
  }
  if (question.type === 'era' || question.maxChoices) {
    const selected = Array.isArray(value) ? value : [];
    return <>
      <div className={`option-grid eras ${textOnly ? '' : 'visual-options'}`}>{question.options.map((option, index) =>
        <label className="option" key={option.label}>
          {option.image && <Preview id={option.image} textOnly={textOnly} />}
          <span className="option-label"><input type="checkbox" disabled={!!question.maxChoices && selected.length >= question.maxChoices && !selected.includes(index)} checked={selected.includes(index)}
            onChange={() => change(selected.includes(index) ? selected.filter(item => item !== index) : [...selected, index])} />
          <span>{option.label}<small>{option.detail}</small></span></span>
        </label>)}</div>
    </>;
  }
  const used = new Set<string>();
  const optionImages = question.options.map(option => {
    if (option.image) return option.image;
    if (question.type === 'duel') return undefined;
    const candidates = questions.filter(q => q.type === 'motif' || q.section === 'C')
      .flatMap(q => q.options).filter(sample => sample.image && !used.has(sample.image));
    const affinity = (sample: typeof option) => cosine(option.vector, sample.vector)
      + sample.motifs.filter(id => option.motifs.includes(id)).length;
    const image = candidates.sort((a, b) => affinity(b) - affinity(a))[0]?.image;
    if (image) used.add(image);
    return image;
  });
  return <div className={`option-grid ${!textOnly ? 'visual-options' : ''}`}>
    {question.options.map((option, index) =>
      <label className="option" key={index}>
        {optionImages[index] && <Preview id={optionImages[index]} textOnly={textOnly} />}
        <span className="option-label">
          <input type="radio" name={question.id} checked={value === index} onChange={() => change(index)} />
          <span>{option.label}{option.detail && <small>{option.detail}</small>}</span>
        </span>
      </label>)}
    {question.type === 'pair' && <label className="option neither"><span className="option-label">
      <input type="radio" name={question.id} checked={value === -1} onChange={() => change(-1)} />
      Neither appeals to me</span></label>}
  </div>;
}

function initialState() {
  const shared = readSession(window.location.hash);
  const base = bank(shared?.mode ?? 'full');
  return { mode: shared?.mode ?? 'full' as Mode, pick: shared?.pick ?? '', answers: shared?.answers ?? {}, duels: shared?.duels ?? [],
    steps: shared ? [...base, ...shared.duels] : base, stage: shared ? 'result' : 'intake' };
}

export function App() {
  const [initial] = useState(initialState);
  const [mode, setMode] = useState(initial.mode);
  const [answers, setAnswers] = useState<Answers>(initial.answers);
  const [duels, setDuels] = useState(initial.duels);
  const [steps, setSteps] = useState(initial.steps);
  const [stage, setStage] = useState(initial.stage);
  const [draft, setDraft] = useState(readDraft);
  const [editing, setEditing] = useState(false);
  const [inspect, setInspect] = useState<number | null>(null);
  const [pick, setPick] = useState(initial.pick);
  const [index, setIndex] = useState(0);
  const [textOnly, setTextOnly] = useState(false);
  const [feedback, setFeedback] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const adaptive = new URLSearchParams(window.location.search).get('adaptive') === '1';

  useEffect(() => {
    if (stage !== 'intake') heading.current?.focus();
  }, [stage, index]);

  useEffect(() => {
    const openSharedResult = () => {
      const shared = readSession(window.location.hash);
      if (!shared) return;
      setPick(shared.pick);
      setMode(shared.mode);
      setAnswers(shared.answers);
      setDuels(shared.duels);
      setSteps([...bank(shared.mode), ...shared.duels]);
      setIndex(0);
      setStage('result');
    };
    window.addEventListener('hashchange', openSharedResult);
    return () => window.removeEventListener('hashchange', openSharedResult);
  }, []);

  useEffect(() => {
    if (stage !== 'quiz' && stage !== 'review') return;
    try {
      localStorage.setItem('intake-progress', JSON.stringify({ hash: new URL(shareUrl(mode, answers, duels)).hash,
        order: steps.map(q => q.id), index, textOnly, stage, editing }));
    } catch { /* Storage can be disabled. */ }
  }, [stage, mode, answers, duels, steps, index, textOnly, editing]);

  function pause() {
    const saved = readDraft();
    if (!saved) { setFeedback('This browser could not save your progress. Keep this tab open to continue.'); return; }
    setDraft(saved); setStage('intake'); setFeedback('');
  }
  function resume() {
    if (!draft) return;
    setMode(draft.mode); setAnswers(draft.answers); setDuels(draft.duels); setSteps(draft.steps);
    setIndex(draft.index); setTextOnly(draft.textOnly); setEditing(draft.editing); setStage(draft.stage);
  }
  function start(nextMode: Mode) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setEditing(false); setPick(''); setDraft(undefined);
    setMode(nextMode);
    setSteps(bank(nextMode));
    setIndex(0);
    setDuels([]);
    setAnswers({});
    setStage('quiz');
    setFeedback('');
  }

  function results(nextAnswers: Answers, earlierDuels: Question[]) {
    const ordinary = bank(mode);
    const profile = buildUserVector([...ordinary, ...earlierDuels], nextAnswers);
    const ranking = rank(scoreAesthetics(profile, styles));
    const hasEvidence = Object.values(profile.vector).some(value => value !== 0)
      || Object.values(profile.motifs).some(value => value !== 0) || profile.eras.size;
    if (!hasEvidence) {
      setFeedback('Answer at least one preference question to see your results.');
      return;
    }
    const direction = mode !== 'quick-draft' && earlierDuels.length % 2 !== 0;
    const duel = earlierDuels.length < (mode === 'quick-draft' ? 3 : 4)
      ? pickDuel(ranking, earlierDuels, direction) ?? (mode !== 'quick-draft' ? pickDuel(ranking, earlierDuels, !direction) : undefined)
      : undefined;
    if (duel) {
      setDuels([...earlierDuels, duel]);
      setSteps(previous => [...previous, duel]);
      setIndex(ordinary.length + earlierDuels.length);
      setStage('quiz');
      return;
    }
    try { localStorage.removeItem('intake-progress'); } catch { /* Storage unavailable. */ }
    setDraft(undefined); setStage('result');
  }

  function advance(skip = false) {
    setFeedback('');
    const question = steps[index];
    const nextAnswers = { ...answers };
    if (skip) {
      delete nextAnswers[question.id];
      if (question.type !== 'duel' && duels.length) {
        duels.forEach(duel => delete nextAnswers[duel.id]);
        setSteps(steps.filter(item => item.type !== 'duel')); setDuels([]);
      }
    }
    else if (nextAnswers[question.id] === undefined) {
      if (question.type === 'slider') nextAnswers[question.id] = 0;
      else if (question.type === 'motif' || question.type === 'era') nextAnswers[question.id] = question.type === 'motif' ? {} : [];
      else return;
    }
    setAnswers(nextAnswers);
    if (editing || (index + 1 === bank(mode).length && question.type !== 'duel')) {
      setEditing(false); setStage('review'); return;
    }
    if (index + 1 < steps.length) {
      const next = steps[index + 1];
      if (adaptive && ['B', 'C', 'E'].includes(next.section)) {
        const profile = buildUserVector(steps, nextAnswers);
        const top = rank(scoreAesthetics(profile, styles)).topPool.map(result => result.aesthetic);
        const nextQuestion = pickNextQuestion(steps.slice(index + 1).filter(item => item.section === next.section),
          nextAnswers, top);
        if (nextQuestion && nextQuestion.id !== next.id) {
          const reordered = [...steps];
          const position = reordered.indexOf(nextQuestion);
          [reordered[index + 1], reordered[position]] = [reordered[position], reordered[index + 1]];
          setSteps(reordered);
        }
      }
      setIndex(index + 1);
    } else results(nextAnswers, duels);
  }

  function change(value: Answer) {
    const question = steps[index];
    if (question.type !== 'duel' && duels.length) {
      const updated = { ...answers, [question.id]: value };
      for (const duel of duels) delete updated[duel.id];
      setAnswers(updated);
      setSteps(steps.filter(item => item.type !== 'duel'));
      setDuels([]);
    } else setAnswers(previous => ({ ...previous, [question.id]: value }));
    setFeedback('');
  }

  const question = steps[index];
  const baseCount = bank(mode).length;
  return <div className="app-shell">
    <Header textOnly={textOnly} setTextOnly={setTextOnly} />
    {stage === 'intake' && <>{draft && <aside className="resume"><button className="button" onClick={resume}>
      {draft.stage === 'review' ? 'Resume answer review' : 'Continue at question ' + (draft.index + 1) + ' of ' + draft.steps.length}</button>
      <button className="button secondary" onClick={() => start(draft.mode)}>Start over</button></aside>}<Intake start={start} /></>}
    {stage === 'review' && <main className="quiz"><h1 tabIndex={-1} ref={heading}>Review your answers</h1>
      <p>Change any answer before the final comparisons.</p><ol className="review-list">{steps.slice(0, baseCount).map((q, i) => {
        const answer = answers[q.id];
        const selected = typeof answer === 'number' && q.type !== 'slider' ? q.options[answer] : undefined;
        return <li key={q.id}>{selected?.image && !textOnly && <Preview id={selected.image} textOnly={false} />}
          <div><strong>{q.prompt}</strong><p>{describeAnswer(q, answer)}</p></div>
          <button aria-label={'Edit question ' + (i + 1)} onClick={() => {setEditing(true); setIndex(i); setStage('quiz');}}>Edit</button></li>;
      })}</ol>{feedback && <p role="alert">{feedback}</p>}<button className="button" onClick={() => results(answers, duels)}>Continue to results</button></main>}
    {stage === 'quiz' && question && <main className="quiz" onClickCapture={event => {
      const image = (event.target as HTMLElement).closest('.sample img');
      if (!image || image.closest('dialog')) return;
      const images = [...event.currentTarget.querySelectorAll('.sample img')];
      event.preventDefault(); event.stopPropagation(); setInspect(images.indexOf(image));
    }}>
      <div className="form-top">
        <p className="kicker">Form 01 / Section {question.section}</p>
        <span>{question.type === 'duel' ? `Tie-break ${index - baseCount + 1} of up to ${mode === 'quick-draft' ? 3 : 4}` : `Question ${index + 1} of ${baseCount}`}</span>
      </div>
      <progress aria-label="Intake progress" value={Math.min(index + 1, baseCount)} max={baseCount} />
      <p className="section-title">{sections[question.section]}</p>
      <h1 ref={heading} tabIndex={-1}>{question.prompt}</h1>
      {question.id === 'context' && <p>Choose up to two settings.</p>}
      {question.instruction && <details key={question.id} className="visual-hint"><summary>What should I look at?</summary><p>{visualHints[question.id] ?? question.instruction}</p></details>}
      {!textOnly && question.options.some(o => o.image) && <button className="inspect-button" onClick={() => setInspect(0)}>Enlarge images</button>}
      {inspect !== null && <Inspector question={question} index={inspect} close={() => setInspect(null)} />}
      <QuestionOptions question={question} value={answers[question.id]} change={change} textOnly={textOnly} />
      {feedback && <p role="alert" className="feedback">{feedback}</p>}
      <div className="quiz-actions">
        <button className="button secondary" onClick={() => {
          setFeedback('');
          if (editing) {setEditing(false); setStage('review');}
          else if (index) setIndex(index - 1);
          else {setDraft(readDraft()); setStage('intake');}
        }}>Back</button>
        <div>
          <button className="button text-button" onClick={pause}>Save &amp; exit</button>
          <button className="button text-button" onClick={() => advance(true)}>Skip</button>
          <button className="button" disabled={['scenario', 'pair', 'duel'].includes(question.type) && answers[question.id] === undefined}
            onClick={() => advance()}>{editing ? 'Return to review' : index === baseCount - 1 ? 'Review answers' : index >= steps.length - 1 ? 'Finish section' : 'Continue'}</button>
        </div>
      </div>
    </main>}
    {stage === 'result' && <ResultView pick={pick} setPick={setPick} mode={mode} answers={answers} duels={duels}
      textOnly={textOnly} heading={heading} retake={() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setStage('intake');
      }} />}
    <Footer />
  </div>;
}
