const sheets = import.meta.glob<string>('./assets/*.webp', { eager: true, import: 'default' });
import { useEffect, useRef, useState } from 'react';
import { previews, styles, questions } from './data.ts';
import { buildUserVector, cosine, pickDuel, pickNextQuestion, rank, scoreAesthetics, type Answer, type Answers, type Question } from './engine/scoring.ts';
import { ResultView } from './results.tsx';
import { bank, readSession, type Mode } from './session.ts';

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
        <span className="mode-meta">34 questions + tie-breaks</span>
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

function Preview({ id, textOnly }: { id: string; textOnly: boolean }) {
  const item = previews.find(preview => preview.id === id);
  if (!item || textOnly) return null;
  const { asset, cols, rows, col, row } = item;
  return <div role="img" aria-label={item.alt} className={`sample sample-${asset}`}
    style={{ backgroundImage: `url(${sheets[`./assets/${asset}.webp`]})`,
      backgroundSize: `${cols * 100}% ${rows * 100}%`,
      backgroundPosition: `${col / (cols - 1) * 100}% ${row / (rows - 1) * 100}%` }} />;
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
      <p className="question-help">Mark any detail you feel strongly about. Leave the rest neutral.</p>
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
      <p className="question-help">{question.maxChoices ? 'Choose up to two places.' : 'Choose any decades that feel nostalgic. Leave them blank if none do.'}</p>
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
          <span>{option.label}</span>
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
  return { mode: shared?.mode ?? 'full' as Mode, answers: shared?.answers ?? {}, duels: shared?.duels ?? [],
    steps: shared ? [...base, ...shared.duels] : base, stage: shared ? 'result' : 'intake' };
}

export function App() {
  const [initial] = useState(initialState);
  const [mode, setMode] = useState(initial.mode);
  const [answers, setAnswers] = useState<Answers>(initial.answers);
  const [duels, setDuels] = useState(initial.duels);
  const [steps, setSteps] = useState(initial.steps);
  const [stage, setStage] = useState(initial.stage);
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

  function start(nextMode: Mode) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
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
      setIndex(index + 1);
      return;
    }
    setStage('result');
  }

  function advance(skip = false) {
    setFeedback('');
    const question = steps[index];
    const nextAnswers = { ...answers };
    if (skip) delete nextAnswers[question.id];
    else if (nextAnswers[question.id] === undefined) {
      if (question.type === 'slider') nextAnswers[question.id] = 0;
      else if (question.type === 'motif' || question.type === 'era') nextAnswers[question.id] = question.type === 'motif' ? {} : [];
      else return;
    }
    setAnswers(nextAnswers);
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
    {stage === 'intake' && <Intake start={start} />}
    {stage === 'quiz' && question && <main className="quiz">
      <div className="form-top">
        <p className="kicker">Form 01 / Section {question.section}</p>
        <span>{question.type === 'duel' ? `Tie-break ${index - baseCount + 1} of up to ${mode === 'quick-draft' ? 3 : 4}` : `Question ${index + 1} of ${baseCount}`}</span>
      </div>
      <progress aria-label="Intake progress" value={Math.min(index + 1, baseCount)} max={baseCount} />
      <p className="section-title">{sections[question.section]}</p>
      <h1 ref={heading} tabIndex={-1}>{question.prompt}</h1>
      {question.type === 'pair' && <p className="question-help">Go with your first instinct. Choose either option or select neither.</p>}
      <QuestionOptions question={question} value={answers[question.id]} change={change} textOnly={textOnly} />
      {feedback && <p role="alert" className="feedback">{feedback}</p>}
      <div className="quiz-actions">
        <button className="button secondary" onClick={() => {
          setFeedback('');
          if (index) setIndex(index - 1);
          else setStage('intake');
        }}>Back</button>
        <div>
          <button className="button text-button" onClick={() => advance(true)}>Skip</button>
          <button className="button" disabled={['scenario', 'pair', 'duel'].includes(question.type) && answers[question.id] === undefined}
            onClick={() => advance()}>{index >= steps.length - 1 ? 'Finish section' : 'Continue'}</button>
        </div>
      </div>
    </main>}
    {stage === 'result' && <ResultView mode={mode} answers={answers} duels={duels}
      textOnly={textOnly} heading={heading} retake={() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setStage('intake');
      }} />}
    <Footer />
  </div>;
}
