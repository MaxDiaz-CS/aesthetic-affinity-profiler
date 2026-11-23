import { mkdir, writeFile } from 'node:fs/promises';
import { styles } from '../src/data.ts';
import { bank } from '../src/session.ts';
import { buildUserVector, cosine, pickDuel, rank, scoreAesthetics, type Aesthetic, type Answer, type Answers, type Question } from '../src/engine/scoring.ts';

const personasPerStyle = 200;
const seed = 20261122;
let state = seed;
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 2 ** 32;
}
function noise(amplitude: number) {
  return (random() + random() - 1) * amplitude;
}

function personaAnswer(question: Question, style: Aesthetic): Answer {
  if (question.type === 'era') return question.options.flatMap((option, index) =>
    random() < (style.decades.includes(option.label) ? 0.85 : 0.04) ? [index] : []);
  if (question.type === 'slider') {
    return Math.max(-2, Math.min(2, Math.round((style.vector[question.axis!] ?? 0) + noise(1.3))));
  }
  if (question.type === 'motif') {
    return Object.fromEntries(question.options.map(option => {
      const id = option.motifs[0];
      const affinity = cosine(style.vector, option.vector) + noise(0.6);
      const love = style.motifIds.includes(id) ? random() < 0.85 : affinity > 0.6;
      return [id, love ? 1 : affinity < -0.31 ? -1 : 0];
    }));
  }
  const ranked = question.options.map((option, index) => ({
    index,
    affinity: (question.avoid ? -1 : 1) * (cosine(style.vector, option.vector)
      + option.motifs.filter(motif => style.motifIds.includes(motif)).length * 0.27) + noise(0.38),
  })).sort((a, b) => b.affinity - a.affinity);
  if (question.maxChoices) return ranked.slice(0, question.maxChoices).map(option => option.index);
  if (question.type === 'pair' && ranked[0].affinity < 0) return -1;
  return ranked[0].index;
}

function simulate(mode: 'full' | 'quick' | 'quick-draft') {
  const questions = bank(mode);
  const topReach = new Set<string>();
  const bottomReach = new Set<string>();
  const recoveries = new Map<string, number>();
  const confusion = new Map<string, { expected: string; actual: string; count: number }>();
  let incompleteBottom = 0;
  for (const style of styles) {
    let recovered = 0;
    for (let i = 0; i < personasPerStyle; i++) {
      const answers: Answers = Object.fromEntries(questions.map(question => [question.id, personaAnswer(question, style)]));
      const duels: Question[] = [];
      const ranking = () => rank(scoreAesthetics(buildUserVector([...questions, ...duels], answers), styles));
      let results = ranking();
      for (let round = 0; round < (mode === 'quick-draft' ? 3 : 4); round++) {
        const preferAvoid = mode !== 'quick-draft' && round % 2 === 1;
        const duel = pickDuel(results, duels, preferAvoid) ?? (mode !== 'quick-draft' ? pickDuel(results, duels, !preferAvoid) : undefined);
        if (!duel) break;
        duels.push(duel);
        answers[duel.id] = personaAnswer(duel, style);
        results = ranking();
      }
      results.top.forEach(result => topReach.add(result.aesthetic.slug));
      results.bottom.forEach(result => bottomReach.add(result.aesthetic.slug));
      if (results.bottom.length < 3) incompleteBottom++;
      if (results.top.some(result => result.aesthetic.slug === style.slug)) recovered++;
      const winner = results.top[0].aesthetic;
      if (winner.slug !== style.slug) {
        const key = `${style.slug}:${winner.slug}`;
        const prior = confusion.get(key);
        if (prior) prior.count++;
        else confusion.set(key, { expected: style.name, actual: winner.name, count: 1 });
      }
    }
    recoveries.set(style.slug, recovered);
  }
  const total = styles.length * personasPerStyle;
  const recoveryCount = [...recoveries.values()].reduce((sum, value) => sum + value, 0);
  return { total, rate: recoveryCount / total,
    incompleteBottom, recoveries,
    confusion: [...confusion.values()].sort((a, b) => b.count - a.count),
    neverTop: styles.filter(style => !topReach.has(style.slug)),
    neverBottom: styles.filter(style => !bottomReach.has(style.slug)),
  };
}

const full = simulate('full');
const quick = simulate('quick');
const draft = simulate('quick-draft');
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const list = (items: Aesthetic[]) => items.map(item => item.name).join(', ') || 'None observed';
const report = [
  '# Aesthetic Affinity Profiler simulation', '',
  `Seed ${seed}. Each mode uses ${personasPerStyle} personas per approved CARI entry (${styles.length} entries).`,
  'Personas select options using vector similarity, signature motif affinity and deterministic random noise. Era recall is imperfect. The simulation uses the same ranking and tie-break logic as the quiz.',
  'The target is at least 80% full-mode recovery. Reachability below means observed within this simulation.', '',
  '| Mode | Profiles | Top-3 recovery | Target ≥80% | Profiles with fewer than 3 eligible bottom results |',
  '| --- | ---: | ---: | --- | ---: |',
  ...([['Full', full], ['Quick', quick], ['Quick proposal (review)', draft]] as const).map(([label, result]) =>
    `| ${label} | ${result.total} | ${percent(result.rate)} | ${result.rate >= 0.8 ? 'Met' : 'Below target'} | ${result.incompleteBottom} |`),
  '', '## Reachability', '',
  `- Full mode, unseen in top 3: ${list(full.neverTop)}`,
  `- Full mode, unseen in bottom 3: ${list(full.neverBottom)}`,
  `- Quick mode, unseen in top 3: ${list(quick.neverTop)}`,
  `- Quick mode, unseen in bottom 3: ${list(quick.neverBottom)}`,
  '', '## Most-confused pairs', '',
  'Rows show the intended persona and a different style ranked first. A target can still appear lower in the top three.', '',
  '| Persona | Ranked first | Full | Quick |', '| --- | --- | ---: | ---: |',
  ...full.confusion.slice(0, 15).map(({ expected, actual, count }) =>
    `| ${expected} | ${actual} | ${count} | ${quick.confusion.find(row => row.expected === expected && row.actual === actual)?.count ?? 0} |`),
  '', '## Recovery by aesthetic', '',
  '| CARI entry | Full top-3 recovery | Quick top-3 recovery |', '| --- | ---: | ---: |',
  ...styles.toSorted((a, b) => full.recoveries.get(a.slug)! - full.recoveries.get(b.slug)!).map(style =>
    `| ${style.name} | ${percent(full.recoveries.get(style.slug)! / personasPerStyle)} | ${percent(quick.recoveries.get(style.slug)! / personasPerStyle)} |`),
  '', 'This is a synthetic benchmark. Human test–retest and face validity require separate playtests.', '',
].join('\n');
const output = new URL('../reports/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('simulation.md', output), report);
console.log(`Full ${percent(full.rate)}, quick ${percent(quick.rate)}. Report at reports/simulation.md`);
