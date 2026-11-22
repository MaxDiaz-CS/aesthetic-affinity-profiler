import { describe, expect, it } from 'vitest';
import { questions, styles, motifs, previews } from '../data.ts';
import { bank } from '../session.ts';
import { contrast, resultTheme } from '../theme.ts';
import { buildUserVector, cosine, explain, pickDuel, pickNextQuestion, rank, scoreAesthetic, scoreAesthetics, ties,
  type Aesthetic, type Question } from './scoring.ts';

const option = (label: string, saturation: number, motifs: string[] = []) => ({ label, vector: { saturation }, motifs });
const pair: Question = { id: 'pair', section: 'B', type: 'pair', prompt: 'Choose', options: [option('Muted', -2), option('Vivid', 2)] };
const era: Question = { id: 'era', section: 'A', type: 'era', prompt: 'Choose', options: [
  { label: '1990s', vector: { 'decades:1990s': 1 }, motifs: [] }] };
const motif: Question = { id: 'grid', section: 'D', type: 'motif', prompt: 'Choose', options: [
  option('Chrome', 1, ['chrome']), option('Wood', 0, ['wood']), option('Silk', 0, ['silk'])] };
const slider: Question = { ...pair, id: 'slider', type: 'slider', axis: 'saturation' };
const scenario: Question = { ...pair, id: 'scenario', type: 'scenario', options: [...pair.options, option('Neutral', 0), option('Soft', -1)] };
const candidate: Aesthetic = { slug: 'candidate', name: 'Candidate', url: '', summary: 'Layered design',
  timeline: null, signature_motifs: [], decades: ['1990s'], vector: { saturation: 2 }, motifIds: ['chrome', 'wood'],
  tag_confidence: 'med' };

describe('preference scoring', () => {
  it('weights forced choices, scenarios, and sliders and normalizes by exposures', () => {
    const profile = buildUserVector([pair, scenario, slider], { pair: 1, scenario: 1, slider: -2 });
    expect(profile.exposures).toEqual({ saturation: 3 });
    expect(profile.vector.saturation).toBeCloseTo((3 + 2.75 - 3) / Math.sqrt(4));
  });

  it('does not include identical option dimensions in forced-choice evidence', () => {
    const question = { ...pair, options: pair.options.map(item => ({ ...item, vector: { ...item.vector, surface: 1 } })) };
    expect(buildUserVector([question], { pair: 0 }).exposures).toEqual({ saturation: 1 });
  });

  it('keeps era separate and treats unmarked grid tiles as shown and neutral', () => {
    const profile = buildUserVector([era, motif], { era: [0], grid: { chrome: 1, silk: -1 } });
    expect([...profile.eras]).toEqual(['1990s']);
    expect(profile.motifs).toEqual({ chrome: 1.5, wood: 0, silk: -2 });
    expect(profile.vector.saturation).toBeCloseTo(0.375 / Math.sqrt(2));
    const result = scoreAesthetic(profile, candidate);
    expect(result.score).toBeCloseTo((0.65 + 0.25 * 0.5 + 0.10) * 0.9);
    expect(result.match).toBe(89);
    expect(result.eligible).toBe(true);
  });

  it('requires four relevant probes or two shown motifs for the bottom list', () => {
    expect(scoreAesthetic(buildUserVector([pair], { pair: 0 }), candidate).eligible).toBe(false);
    const many = Array.from({ length: 4 }, (_, i) => ({ ...pair, id: `pair-${i}` }));
    const profile = buildUserVector(many, Object.fromEntries(many.map(question => [question.id, 0])));
    expect(scoreAesthetic(profile, candidate).eligible).toBe(true);
    expect(scoreAesthetic(profile, { ...candidate, vector: { geometry: 2 } }).eligible).toBe(false);
  });

  it('keeps undefined vectors finite and applies confidence shrinkage', () => {
    expect(cosine({}, { saturation: 1 })).toBe(0);
    const profile = buildUserVector([pair], { pair: 0 });
    expect(scoreAesthetic(profile, { ...candidate, tag_confidence: 'low' }).score).toBeCloseTo(-0.52);
    expect(scoreAesthetic(profile, candidate).match).toBe(21);
  });

  it('finds close boundary duels without repeats and labels the score tie', () => {
    const results = Array.from({ length: 8 }, (_, i) => ({
      aesthetic: { ...candidate, slug: `entry-${i}`, name: `Entry ${i}` },
      score: 0.78 - i * 0.015, match: 80 - i, eligible: true,
    }));
    const ranked = rank(results.toReversed());
    expect(ranked.top.map(row => row.aesthetic.slug)).toEqual(['entry-0', 'entry-1', 'entry-2']);
    expect(ranked.bottom.map(row => row.aesthetic.slug)).toEqual(['entry-7', 'entry-6', 'entry-5']);
    expect(ties(ranked.topPool)).toContain('Entry 3');
    const duel = pickDuel(ranked, [], false)!;
    expect(duel.type).toBe('duel');
    expect(pickDuel(ranked, [duel], false)?.id).not.toBe(duel.id);
  });

  it('uses negative contribution to explain avoidance and finds an unasked adaptive probe', () => {
    expect(explain([pair], { pair: 0 }, candidate, true)).toEqual(['You picked muted.']);
    expect(explain([pair], { pair: 0 }, candidate)).toEqual([]);
    expect(pickNextQuestion([pair, slider], { slider: 0 }, [candidate, { ...candidate, vector: { saturation: -2 } }])).toBe(pair);
  });
});

describe('release data', () => {
  it('has complete quiz modes, motif tiles and sourced-image placeholder entries', () => {
    expect(bank('full')).toHaveLength(31);
    expect(bank('quick')).toHaveLength(15);
    expect(bank('quick').filter(question => question.type === 'motif')).toHaveLength(3);
    expect(motifs).toHaveLength(36);
    expect(previews).toHaveLength(24);
    expect(new Set(styles.map(style => style.slug)).size).toBe(styles.length);
    expect(styles.every(style => style.summary && style.signature_motifs.length >= 3)).toBe(true);
    expect(questions.filter(question => question.type === 'pair').every(question => {
      const [a, b] = question.options;
      const keys = new Set([...Object.keys(a.vector), ...Object.keys(b.vector)]);
      const differences = [...keys].filter(key => (a.vector[key] ?? 0) !== (b.vector[key] ?? 0));
      return differences.length >= 1 && differences.length <= 2;
    })).toBe(true);
  });

  it('creates neutral scores for blank answers and checks contrast on every result theme', () => {
    const blank = rank(scoreAesthetics(buildUserVector(questions, {}), styles));
    expect(blank.bottom).toHaveLength(0);
    expect(blank.full.every(result => result.match === 50)).toBe(true);
    for (const style of [undefined, ...styles]) {
      const theme = resultTheme(style);
      for (const surface of [theme.paper, theme.soft]) {
        expect(contrast(theme.ink, surface), style?.slug).toBeGreaterThanOrEqual(4.5);
        expect(contrast(theme.accent, surface), style?.slug).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
