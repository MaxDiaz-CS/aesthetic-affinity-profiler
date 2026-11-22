import catalog from '../data/quiz_catalog.json' with { type: 'json' };
import dimensions from '../data/dimensions.json' with { type: 'json' };
import questionBank from '../data/questions.json' with { type: 'json' };
import motifBank from '../data/motifs.json' with { type: 'json' };
import images from '../data/images.json' with { type: 'json' };
import summaries from '../data/summaries.json' with { type: 'json' };
import type { Aesthetic, Question, Vector } from './engine/scoring.ts';

export const questions = questionBank as Question[];
export const motifs = motifBank;
export const previews = images;
export const axes = dimensions.flatMap(dimension =>
  dimension.kind === 'ordinal' ? [{ id: dimension.id, negative: dimension.negative!, positive: dimension.positive! }] : []);
export const styles: Aesthetic[] = catalog.map(entry => {
  const vector: Vector = {};
  const fields: Record<string, unknown> = entry;
  for (const dimension of dimensions) {
    if (dimension.id === 'decades') continue;
    const value = fields[dimension.id];
    if (typeof value === 'number') vector[dimension.id] = value;
    if (Array.isArray(value)) for (const tag of value) vector[`${dimension.id}:${tag}`] = 1;
  }
  const phrases = entry.signature_motifs.map(phrase => phrase.toLowerCase());
  const motifIds = motifs.filter(motif => motif.patterns.some(pattern =>
    phrases.some(phrase => phrase.includes(pattern)))).map(motif => motif.id);
  const summary = (summaries as Record<string, string>)[entry.slug];
  if (!summary) throw new Error(`Missing CARI paraphrase for ${entry.slug}`);
  return { ...entry, vector, motifIds, summary,
    tag_confidence: entry.tag_confidence as Aesthetic['tag_confidence'] };
});
