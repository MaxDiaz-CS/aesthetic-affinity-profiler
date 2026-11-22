export type Vector = Record<string, number>;
export type Option = { label: string; vector: Vector; motifs: string[]; image?: string };
export type Question = {
  id: string; section: string; type: 'era' | 'pair' | 'scenario' | 'motif' | 'slider' | 'duel';
  prompt: string; options: Option[]; quick?: boolean; axis?: string; avoid?: boolean;
};
export type Answer = number | number[] | Record<string, -1 | 0 | 1>;
export type Answers = Record<string, Answer>;
export type Aesthetic = {
  slug: string; name: string; url: string; timeline: string | null;
  signature_motifs: string[]; decades: string[]; vector: Vector; motifIds: string[];
  tag_confidence: 'low' | 'med' | 'high'; summary: string;
};
export type Profile = { vector: Vector; exposures: Vector; probes: Set<string>[]; motifs: Vector; eras: Set<string> };
export type Result = { aesthetic: Aesthetic; score: number; match: number; eligible: boolean };
export const TIE_GAP = 0.05;

function add(target: Vector, vector: Vector, weight: number) {
  for (const [key, value] of Object.entries(vector)) target[key] = (target[key] ?? 0) + weight * value;
}

function markMotifs(target: Vector, motifs: string[], weight: number) {
  for (const motif of motifs) target[motif] = (target[motif] ?? 0) + weight;
}

export function buildUserVector(questions: Question[], answers: Answers): Profile {
  const vector: Vector = {};
  const exposures: Vector = {};
  const probes: Set<string>[] = [];
  const motifs: Vector = {};
  const eras = new Set<string>();
  for (const question of questions) {
    const answer = answers[question.id];
    if (answer === undefined) continue;
    const probed = new Set<string>();
    if (question.type === 'era' && Array.isArray(answer)) {
      for (const index of answer) {
        for (const key of Object.keys(question.options[index]?.vector ?? {})) eras.add(key.slice(8));
      }
    } else if (question.type === 'motif' && typeof answer === 'object' && !Array.isArray(answer) && answer) {
      for (const option of question.options) {
        const vote = answer[option.motifs[0]];
        const weight = vote === 1 ? 1.5 : vote === -1 ? -2 : 0;
        markMotifs(motifs, option.motifs, weight);
        if (weight) {
          add(vector, option.vector, weight * 0.25);
          Object.keys(option.vector).forEach(key => probed.add(key));
        }
      }
    } else if (question.type === 'slider' && typeof answer === 'number' && Number.isFinite(answer) && question.axis) {
      add(vector, { [question.axis]: Math.max(-2, Math.min(2, answer)) }, 1.5);
      probed.add(question.axis);
    } else if ((question.type === 'pair' || question.type === 'scenario' || question.type === 'duel')
      && typeof answer === 'number' && question.options[answer]) {
      const keys = new Set(question.options.flatMap(option => Object.keys(option.vector)));
      for (const key of keys) {
        const values = new Set(question.options.map(option => option.vector[key] ?? 0));
        if (values.size > 1) probed.add(key);
      }
      question.options.forEach((option, index) => {
        const weight = index === answer ? 1 : question.type === 'scenario' ? -0.25 : -0.5;
        const signed = question.avoid ? -weight : weight;
        add(vector, Object.fromEntries(Object.entries(option.vector).filter(([key]) => probed.has(key))), signed);
        markMotifs(motifs, option.motifs, signed);
      });
    }
    if (probed.size) {
      probes.push(probed);
      for (const key of probed) exposures[key] = (exposures[key] ?? 0) + 1;
    }
  }
  for (const key of Object.keys(vector)) vector[key] /= Math.sqrt((exposures[key] ?? 0) + 1);
  return { vector, exposures, probes, motifs, eras };
}

export function cosine(left: Vector, right: Vector): number {
  let dot = 0;
  let leftLength = 0;
  let rightLength = 0;
  for (const [key, value] of Object.entries(left)) {
    dot += value * (right[key] ?? 0);
    leftLength += value ** 2;
  }
  for (const value of Object.values(right)) rightLength += value ** 2;
  return leftLength && rightLength ? dot / Math.sqrt(leftLength * rightLength) : 0;
}

export function scoreAesthetic(profile: Profile, aesthetic: Aesthetic): Result {
  const shown = aesthetic.motifIds.filter(motif => Object.hasOwn(profile.motifs, motif));
  const motifScore = shown.length
    ? shown.reduce((sum, motif) => {
      const value = profile.motifs[motif];
      return sum + Math.max(-1, Math.min(1, value / (value < 0 ? 2 : 1.5)));
    }, 0) / shown.length : 0;
  const eraOverlap = profile.eras.size
    ? aesthetic.decades.filter(era => profile.eras.has(era)).length / profile.eras.size : 0;
  const confidence = { low: 0.8, med: 0.9, high: 1 }[aesthetic.tag_confidence];
  const score = (0.65 * cosine(profile.vector, aesthetic.vector) + 0.25 * motifScore + 0.10 * eraOverlap) * confidence;
  const relevantProbes = profile.probes.filter(keys => [...keys].some(key => Object.hasOwn(aesthetic.vector, key))).length;
  return { aesthetic, score, match: Math.max(1, Math.min(99, Math.round(50 + 50 * score))),
    eligible: shown.length >= 2 || relevantProbes >= 4 };
}

export function scoreAesthetics(profile: Profile, aesthetics: Aesthetic[]) {
  return aesthetics.map(aesthetic => scoreAesthetic(profile, aesthetic));
}

export function rank(results: Result[]) {
  const full = results.toSorted((a, b) => b.score - a.score || a.aesthetic.slug.localeCompare(b.aesthetic.slug));
  const topPool = full.slice(0, 6);
  const bottomPool = full.slice(3).filter(result => result.eligible).reverse().slice(0, 6);
  return { full, topPool, bottomPool, top: topPool.slice(0, 3), bottom: bottomPool.slice(0, 3) };
}

export function ties(pool: Result[]) {
  return pool[2] && pool[3] && Math.abs(pool[2].score - pool[3].score) < TIE_GAP
    ? pool.filter((result, index) => index > 2 && Math.abs(result.score - pool[2].score) < TIE_GAP)
      .map(result => result.aesthetic.name) : [];
}

function answerLabel(question: Question, answer: Answer) {
  if (question.type === 'era' && Array.isArray(answer)) {
    return `Decades you chose: ${answer.map(index => question.options[index]?.label).filter(Boolean).join(', ')}`;
  }
  if (question.type === 'slider' && typeof answer === 'number') {
    if (!answer) return '';
    return `You leaned toward ${question.options[answer > 0 ? 1 : 0].label.toLowerCase()}.`;
  }
  if (typeof answer === 'number' && question.options[answer]) {
    return `${question.avoid ? 'You avoided' : 'You picked'} ${question.options[answer].label.toLowerCase()}.`;
  }
  return '';
}

export function explain(questions: Question[], answers: Answers, aesthetic: Aesthetic, avoid = false) {
  const baseline = scoreAesthetic(buildUserVector(questions, answers), aesthetic).score;
  const contributions: { label: string; contribution: number }[] = [];
  const addEffect = (label: string, modified: Answers) => {
    const without = scoreAesthetic(buildUserVector(questions, modified), aesthetic).score;
    const contribution = (baseline - without) * (avoid ? -1 : 1);
    if (label && contribution > 0.000001) contributions.push({ label, contribution });
  };
  for (const question of questions) {
    const answer = answers[question.id];
    if (answer === undefined) continue;
    if (question.type === 'motif' && typeof answer === 'object' && answer && !Array.isArray(answer)) {
      for (const option of question.options) {
        const key = option.motifs[0];
        if (!answer[key]) continue;
        addEffect(`You ${answer[key] > 0 ? 'liked' : 'disliked'} ${option.label.toLowerCase()}.`,
          { ...answers, [question.id]: { ...answer, [key]: 0 } });
      }
    } else {
      const without = { ...answers };
      delete without[question.id];
      addEffect(answerLabel(question, answer), without);
    }
  }
  return contributions.sort((a, b) => b.contribution - a.contribution).slice(0, 3).map(item => item.label);
}

export function pickDuel(ranking: ReturnType<typeof rank>, past: Question[], avoid: boolean): Question | undefined {
  const pool = avoid ? ranking.bottomPool : ranking.topPool;
  if (!ties(pool).length) return;
  const candidates = pool.slice(0, 3).flatMap(left => pool.slice(3).map(right => ({ left, right })))
    .filter(({ left, right }) => Math.abs(left.score - right.score) < TIE_GAP)
    .sort((a, b) => Math.abs(a.left.score - a.right.score) - Math.abs(b.left.score - b.right.score));
  for (const { left, right } of candidates) {
    const styles = [left.aesthetic, right.aesthetic].sort((a, b) => a.slug.localeCompare(b.slug));
    const id = `duel-${avoid ? 'avoid' : 'prefer'}:${styles.map(style => style.slug).join(':')}`;
    if (past.some(duel => duel.id === id)) continue;
    return makeDuel(styles, avoid);
  }
}

export function makeDuel(styles: Aesthetic[], avoid: boolean): Question {
  const id = `duel-${avoid ? 'avoid' : 'prefer'}:${styles.map(style => style.slug).join(':')}`;
  return { id, section: 'F', type: 'duel', avoid,
    prompt: avoid ? 'Which visual direction would you rather avoid?' : 'Which visual direction feels more like you?',
    options: styles.map(style => ({ label: style.summary, vector: style.vector, motifs: style.motifIds })) };
}

export function pickNextQuestion(questions: Question[], answers: Answers, top: Aesthetic[]) {
  const candidates = questions.filter(question => !Object.hasOwn(answers, question.id)
    && ['pair', 'scenario', 'slider'].includes(question.type));
  return candidates.map(question => {
    const options = question.type === 'slider' ? [-2, 2] : question.options.map((_, index) => index);
    const outcomes = options.map(option => {
      const profile = buildUserVector(questions, { ...answers, [question.id]: option });
      return scoreAesthetics(profile, top).map(result => result.score);
    });
    let spread = 0;
    for (let a = 0; a < top.length; a++) {
      for (let b = a + 1; b < top.length; b++) {
        const gaps = outcomes.map(scores => scores[a] - scores[b]);
        spread = Math.max(spread, Math.max(...gaps) - Math.min(...gaps));
      }
    }
    return { question, spread };
  }).sort((a, b) => b.spread - a.spread)[0]?.question;
}
