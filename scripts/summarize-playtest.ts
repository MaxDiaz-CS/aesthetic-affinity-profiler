import { readFile } from 'node:fs/promises';
import { styles } from '../src/data.ts';

type Record = { version: number; participant: string; session: number; mode: string;
  date: string; faceValidity: number; top: string[] };
const filenames = process.argv.slice(2);
if (!filenames.length) throw new Error('Pass one or more downloaded playtest JSON files');
const slugs = new Set(styles.map(style => style.slug));
const participants = new Map<string, Map<number, Record>>();
const ratings: number[] = [];
for (const filename of filenames) {
  const item = JSON.parse(await readFile(filename, 'utf8')) as Record;
  if (item.version !== 1 || !/^[a-z0-9-]{2,32}$/.test(item.participant) || ![1, 2].includes(item.session)
    || !['full', 'quick'].includes(item.mode) || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
    || !Number.isFinite(Date.parse(item.date)) || ![1, 2, 3, 4, 5].includes(item.faceValidity)
    || !Array.isArray(item.top) || new Set(item.top).size !== 3 || !item.top.every(slug => slugs.has(slug))) {
    throw new Error(`Invalid playtest record: ${filename}`);
  }
  const sessions = participants.get(item.participant) ?? new Map();
  if (sessions.has(item.session)) throw new Error(`Duplicate session for participant ${item.participant}`);
  sessions.set(item.session, item);
  participants.set(item.participant, sessions);
  ratings.push(item.faceValidity);
}
const pairs = [...participants.values()].flatMap(sessions => {
  const first = sessions.get(1);
  const second = sessions.get(2);
  if (!first || !second || first.mode !== second.mode || first.date > second.date) return [];
  return [{ overlap: first.top.filter(slug => second.top.includes(slug)).length,
    days: (Date.parse(second.date) - Date.parse(first.date)) / 86_400_000 }];
});
const mean = (values: number[]) => values.length
  ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2) : 'Pending';
console.log([
  '# Playtest summary', '',
  `- Participants: ${participants.size}`,
  `- Same-mode test–retest pairs: ${pairs.length}`,
  `- Mean test–retest interval in days: ${mean(pairs.map(pair => pair.days))}`,
  `- Mean top-three overlap: ${mean(pairs.map(pair => pair.overlap))} / 3`,
  `- Pairs meeting the two-of-three target: ${pairs.filter(pair => pair.overlap >= 2).length} / ${pairs.length}`,
  `- Mean first-match rating: ${mean(ratings)} / 5 across ${ratings.length} sessions`,
].join('\n'));
