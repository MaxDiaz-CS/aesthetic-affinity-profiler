import { questions, styles } from './data.ts';
import { makeDuel, type Answer, type Answers, type Question } from './engine/scoring.ts';

export type Mode = 'full' | 'quick' | 'quick-draft';
export function bank(mode: Mode) { return questions.filter(question => mode === 'full' || (mode === 'quick-draft' ? question.quickDraft : question.quick)); }

function validatedAnswer(question: Question, raw: unknown): Answer | undefined {
  if (question.type === 'era' || (question.maxChoices && Array.isArray(raw))) {
    if (!Array.isArray(raw) || !raw.every(value => Number.isInteger(value) && question.options[value])) return;
    return [...new Set(raw)].slice(0, question.maxChoices ?? raw.length);
  }
  if (question.type === 'motif') {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const votes = raw as Record<string, unknown>;
    return Object.fromEntries(question.options.flatMap(({ motifs: [id] }) => {
      const vote = votes[id];
      return vote === -1 || vote === 0 || vote === 1 ? [[id, vote]] : [];
    }));
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return;
  if (question.type === 'pair' && raw === -1) return -1;
  if (question.type === 'slider') return raw >= -2 && raw <= 2 ? raw : undefined;
  return question.options[raw] ? raw : undefined;
}

export function readSession(hash: string) {
  const data = new URLSearchParams(hash.slice(1)).get('result');
  if (!data || data.length > 16000) return;
  try {
    const decoded = JSON.parse(atob(data));
    if (decoded.version !== 1 || !['full', 'quick', 'quick-draft'].includes(decoded.mode) || !decoded.answers
      || typeof decoded.answers !== 'object' || Array.isArray(decoded.answers)) return;
    const mode = decoded.mode as Mode;
    const duels: Question[] = [];
    for (const id of Array.isArray(decoded.duels) ? decoded.duels.slice(0, 4) : []) {
      if (typeof id !== 'string') continue;
      const [kind, a, b] = id.split(':');
      if (kind !== 'duel-avoid' && kind !== 'duel-prefer') continue;
      const left = styles.find(style => style.slug === a);
      const right = styles.find(style => style.slug === b);
      if (!left || !right || a >= b || duels.some(question => question.id === id)) continue;
      const duel = makeDuel([left, right], kind === 'duel-avoid');
      if (duel.id === id) duels.push(duel);
    }
    const answers: Answers = {};
    for (const question of [...bank('full'), ...duels]) {
      const answer = validatedAnswer(question, decoded.answers[question.id]);
      if (answer !== undefined) answers[question.id] = answer;
    }
    if (Object.keys(answers).length) return { mode, answers, duels };
  } catch {
    return undefined;
  }
}

export function shareUrl(mode: Mode, answers: Answers, duels: Question[]) {
  const url = new URL(window.location.href);
  url.hash = new URLSearchParams({
    result: btoa(JSON.stringify({ version: 1, mode, answers, duels: duels.map(question => question.id) })),
  }).toString();
  return url.href;
}
