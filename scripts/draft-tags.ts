import { readFile, rename, writeFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

type Dimension =
  | { id: string; kind: 'ordinal'; min: number; max: number }
  | { id: string; kind: 'multi_hot'; values: string[] };

type SnapshotEntry = {
  slug: string;
  name: string;
  url: string;
  description: string | null;
  key_motifs: string[];
};

type Seed = Record<string, Record<string, unknown>>;
type ReviewRow = Record<string, string>;

const data = new URL('../data/', import.meta.url);
const reviewFile = new URL('cari_tag_review.csv', data);
const outputFile = new URL('aesthetics.json', data);
const confidenceLevels = ['low', 'med', 'high'];

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(new URL(filename, data), 'utf8')) as T;
}

function validateCoverage(slugs: string[], entries: SnapshotEntry[], source: string) {
  const expected = new Set(entries.map(entry => entry.slug));
  const found = new Set(slugs);
  const missing = [...expected].filter(slug => !found.has(slug));
  const extra = [...found].filter(slug => !expected.has(slug));
  if (missing.length || extra.length || found.size !== slugs.length) {
    throw new Error(`${source}: expected one row per CARI slug. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}. Duplicate rows: ${slugs.length - found.size}.`);
  }
}

function parseVector(seed: Record<string, unknown>, dimensions: Dimension[], slug: string) {
  return Object.fromEntries(dimensions.map(dimension => {
    const value = seed[dimension.id];
    const key = `${slug}/${dimension.id}`;
    if (dimension.kind === 'ordinal') {
      if (value == null) return [dimension.id, null];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < dimension.min || value > dimension.max) {
        throw new Error(`${key}: expected an integer from ${dimension.min} to ${dimension.max} or a blank cell`);
      }
      return [dimension.id, value];
    }

    const values = value ?? [];
    if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !dimension.values.includes(value))
      || new Set(values).size !== values.length) {
      throw new Error(`${key}: expected distinct values from ${dimension.values.join(', ')}`);
    }
    return [dimension.id, values];
  }));
}

function sourceMotifs(entry: SnapshotEntry, value: unknown) {
  if (!Array.isArray(value) || value.length > 8 || new Set(value).size !== value.length) {
    throw new Error(`${entry.slug}: expected an array with up to 8 distinct signature motifs`);
  }
  return value.map((motif: unknown) => {
    if (typeof motif !== 'string' || !motif.trim() || motif.trim() !== motif) {
      throw new Error(`${entry.slug}: expected a nonempty, trimmed motif phrase`);
    }
    if (entry.key_motifs.includes(motif)) return { motif, source: 'key_motifs' };
    if (entry.description?.includes(motif)) return { motif, source: 'description' };
    throw new Error(`${entry.slug}: motif "${motif}" must appear verbatim in its CARI description or motif list`);
  });
}

function draftConfidence(entry: SnapshotEntry, motifCount: number) {
  const words = entry.description?.match(/\S+/g)?.length ?? 0;
  if (motifCount < 3 || (words < 25 && entry.key_motifs.length === 0)) return 'low';
  if (entry.key_motifs.length >= 5 || (words >= 55 && motifCount >= 5)) return 'high';
  return 'med';
}

function reviewColumns(dimensions: Dimension[]) {
  return [
    'slug', 'approval', 'tag_confidence', ...dimensions.map(dimension => dimension.id),
    'signature_motifs', 'motif_provenance', 'cari_url', 'review_notes',
  ];
}

function draftCsv(entries: SnapshotEntry[], dimensions: Dimension[], seed: Seed) {
  validateCoverage(Object.keys(seed), entries, 'Draft seed');
  const rows = entries.map(entry => {
    const draft = seed[entry.slug];
    const vector = parseVector(draft, dimensions, entry.slug);
    const motifs = sourceMotifs(entry, draft.signature_motifs);
    return {
      slug: entry.slug,
      approval: 'pending',
      tag_confidence: draftConfidence(entry, motifs.length),
      ...Object.fromEntries(Object.entries(vector).map(([id, value]) => [
        id, Array.isArray(value) ? JSON.stringify(value) : value ?? '',
      ])),
      signature_motifs: JSON.stringify(motifs.map(item => item.motif)),
      motif_provenance: JSON.stringify(motifs.map(item => item.source)),
      cari_url: entry.url,
      review_notes: motifs.length < 3 ? 'Fewer than 3 source-backed motifs in this draft. Review the source before approval.' : '',
    };
  });
  return stringify(rows, { header: true, columns: reviewColumns(dimensions) });
}

function parseCell(cell: string, label: string): unknown {
  if (!cell.trim()) return undefined;
  try {
    return JSON.parse(cell);
  } catch {
    throw new Error(`${label}: invalid JSON cell`);
  }
}

function readReview(csv: string, entries: SnapshotEntry[], dimensions: Dimension[]) {
  const expectedColumns = reviewColumns(dimensions);
  const rows: ReviewRow[] = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    columns: (header: string[]) => {
      if (new Set(header).size !== header.length || header.length !== expectedColumns.length
        || expectedColumns.some(column => !header.includes(column))) {
        throw new Error('Review CSV has missing, duplicate, or unexpected columns');
      }
      return header;
    },
  });
  validateCoverage(rows.map(row => row.slug), entries, 'Review CSV');
  const bySlug = new Map(rows.map(row => [row.slug, row]));
  const unresolved: string[] = [];
  const sparse: string[] = [];
  const tagged = entries.map(entry => {
    const row = bySlug.get(entry.slug)!;
    if (row.cari_url !== entry.url) throw new Error(`${entry.slug}: source URL differs from the CARI snapshot`);
    const approval = row.approval.trim().toLowerCase();
    if (approval !== 'approved' && approval !== 'pending') {
      throw new Error(`${entry.slug}: approval must be pending or approved`);
    }
    if (approval === 'pending') unresolved.push(entry.slug);
    const confidence = row.tag_confidence.trim().toLowerCase();
    if (!confidenceLevels.includes(confidence)) throw new Error(`${entry.slug}: invalid tag_confidence`);

    const values = Object.fromEntries(dimensions.map(dimension => [
      dimension.id, parseCell(row[dimension.id], `${entry.slug}/${dimension.id}`),
    ]));
    const motifs = sourceMotifs(entry, parseCell(row.signature_motifs, `${entry.slug}/signature_motifs`));
    if (motifs.length < 3) {
      if (confidence !== 'low') throw new Error(`${entry.slug}: sparse motif coverage requires low confidence`);
      sparse.push(entry.slug);
    }

    return {
      ...entry,
      ...parseVector(values, dimensions, entry.slug),
      signature_motifs: motifs.map(item => item.motif),
      motif_provenance: motifs,
      tag_confidence: confidence,
    };
  });
  return { tagged, unresolved, sparse };
}

async function main() {
  const mode = process.argv[2] ?? 'draft';
  if (!['draft', 'check', 'publish', 'export-quiz'].includes(mode) || process.argv.length > 3) {
    throw new Error('Usage: node scripts/draft-tags.ts [draft|check|publish|export-quiz]');
  }
  const [entries, dimensions] = await Promise.all([
    readJson<SnapshotEntry[]>('cari_snapshot_2026-11-22.json'),
    readJson<Dimension[]>('dimensions.json'),
  ]);
  validateCoverage(entries.map(entry => entry.slug), entries, 'CARI snapshot');

  if (mode === 'draft') {
    const seed = await readJson<Seed>('cari_tag_seed.json');
    const csv = draftCsv(entries, dimensions, seed);
    try {
      await writeFile(reviewFile, csv, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (await readFile(reviewFile, 'utf8') !== csv) {
        throw new Error('The existing review differs from the generated draft. Move it aside to generate a fresh review.');
      }
    }
    console.log(`Prepared ${entries.length} CARI rows in ${reviewFile.pathname}`);
    return;
  }

  const { tagged, unresolved, sparse } = readReview(await readFile(reviewFile, 'utf8'), entries, dimensions);
  console.log(`Validated ${tagged.length} rows. ${tagged.length - unresolved.length} approved, ${unresolved.length} pending, ${sparse.length} with fewer than 3 motifs.`);
  if (mode === 'check') return;
  if (mode === 'export-quiz') {
    const eligible = tagged.filter(entry =>
      !unresolved.includes(entry.slug) && !sparse.includes(entry.slug));
    if (eligible.length < 6) throw new Error('At least six eligible entries are required for the quiz');
    const quizCatalog = new URL('quiz_catalog.json', data);
    const temporary = new URL(`quiz_catalog.json.${process.pid}.tmp`, data);
    const projected = eligible.map(entry => {
      const fields: Record<string, unknown> = entry;
      return {
        slug: entry.slug, name: entry.name, url: entry.url, timeline: fields.timeline,
        signature_motifs: entry.signature_motifs, tag_confidence: entry.tag_confidence,
        ...Object.fromEntries(dimensions.map(({ id }) => [id, fields[id]])),
      };
    });
    await writeFile(temporary, `${JSON.stringify(projected, null, 2)}\n`);
    await rename(temporary, quizCatalog);
    console.log(`Exported ${eligible.length} reviewed entries for the quiz`);
    return;
  }
  if (unresolved.length) throw new Error(`Publishing requires approval for all ${tagged.length} rows`);
  if (sparse.length) throw new Error(`Publishing requires at least 3 CARI-backed motifs per entry. Sparse rows: ${sparse.join(', ')}`);
  const temporary = new URL(`aesthetics.json.${process.pid}.tmp`, data);
  await writeFile(temporary, `${JSON.stringify(tagged, null, 2)}\n`);
  await rename(temporary, outputFile);
  console.log(`Wrote ${tagged.length} approved records to ${outputFile.pathname}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
