import { useState } from 'react';
import dimensions from '../data/dimensions.json' with { type: 'json' };
import { styles } from './data.ts';
import { buildUserVector, rank, scoreAesthetics, type Result } from './engine/scoring.ts';
import { bank, readSession } from './session.ts';

const label = (value: string) => value.replaceAll('_', ' ').replace(/^./, first => first.toUpperCase());
const filters = [
  ['decades', 'Decade'], ['palette', 'Palette'], ['texture', 'Material'], ['context', 'Context'],
] as const;

export function ExploreCatalog({ full }: { full: Result[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [sort, setSort] = useState('match');
  const search = query.toLowerCase().trim().split(/\s+/);
  const matches = full.filter(({ aesthetic }) => {
    const searchable = [aesthetic.name, aesthetic.summary, ...aesthetic.signature_motifs].join(' ').toLowerCase();
    return search.every(term => searchable.includes(term)) && filters.every(([key]) => {
      const value = selected[key];
      if (!value) return true;
      return key === 'decades' ? aesthetic.decades.includes(value) : !!aesthetic.vector[`${key}:${value}`];
    });
  });
  if (sort === 'name') matches.sort((a, b) => a.aesthetic.name.localeCompare(b.aesthetic.name));

  return <details className="full-ranking explore">
    <summary>Explore all {full.length} ranked aesthetics</summary>
    <div className="catalog-controls">
      <label className="catalog-search">Search the catalog
        <input type="search" value={query} onChange={e => setQuery(e.currentTarget.value)} placeholder="Name, motif, or description" />
      </label>
      {filters.map(([key, title]) => <label key={key}>{title}
        <select value={selected[key] ?? ''} onChange={e => setSelected({ ...selected, [key]: e.currentTarget.value })}>
          <option value="">Any {title.toLowerCase()}</option>
          {dimensions.find(dimension => dimension.id === key)?.values?.map(value =>
            <option key={value} value={value}>{label(value)}</option>)}
        </select>
      </label>)}
      <label>Sort by<select value={sort} onChange={e => setSort(e.currentTarget.value)}>
        <option value="match">Highest match</option><option value="name">Name</option>
      </select></label>
    </div>
    <p role="status">{matches.length} of {full.length} aesthetics</p>
    {matches.length === 0 && <button className="button secondary" onClick={() => { setQuery(''); setSelected({}); }}>Reset filters</button>}
    <ol className="catalog-list">{matches.map(({ aesthetic, match }) => <li key={aesthetic.slug}>
      <div><a href={aesthetic.url}>{aesthetic.name}</a><p>{aesthetic.summary}</p></div><strong>{match}%</strong>
    </li>)}</ol>
  </details>;
}

export function CompareProfiles({ original }: { original: ReturnType<typeof rank> }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [comparison, setComparison] = useState<ReturnType<typeof rank>>();
  const shared = original.top.filter(item => comparison?.top.some(entry => entry.aesthetic.slug === item.aesthetic.slug));
  const otherMatches = new Map(comparison?.full.map(result => [result.aesthetic.slug, result.match]));
  const differences = comparison ? original.full.flatMap(result => {
    const otherMatch = otherMatches.get(result.aesthetic.slug);
    return otherMatch === undefined ? [] : [{ ...result, otherMatch, gap: Math.abs(result.match - otherMatch) }];
  }).filter(result => result.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3) : [];
  return <details className="full-ranking explore">
    <summary>Compare with a friend</summary>
    <form className="compare-form" onSubmit={event => {
      event.preventDefault();
      setComparison(undefined);
      let session: ReturnType<typeof readSession>;
      try {
        const value = input.trim();
        const hash = value.startsWith('#') ? value : new URL(value).hash;
        session = readSession(hash);
      } catch { session = undefined; }
      if (!session) { setError('Paste a valid Aesthetic Affinity Profiler results link.'); return; }
      const profile = buildUserVector([...bank(session.mode), ...session.duels], session.answers);
      const hasEvidence = Object.values(profile.vector).some(Boolean) || Object.values(profile.motifs).some(Boolean) || profile.eras.size;
      if (!hasEvidence) { setError('This link does not contain enough preference evidence to compare.'); return; }
      setError('');
      setComparison(rank(scoreAesthetics(profile, styles)));
    }}>
      <label>Friend’s results link <input required maxLength={18000} value={input} onChange={event => {
        setInput(event.currentTarget.value);
        setError('');
        setComparison(undefined);
      }} /></label>
      <button className="button" type="submit">Compare profiles</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {comparison && <div className="comparison" aria-live="polite">
      <p><strong>Shared top matches:</strong> {shared.length ? shared.map(item => item.aesthetic.name).join(', ') : 'None in both top threes.'}</p>
      <div className="comparison-top">{([['Your top three', original.top], ['Their top three', comparison.top]] as const).map(([title, entries]) =>
        <div key={title}><h3>{title}</h3><ol>{entries.map(result =>
          <li key={result.aesthetic.slug}>{result.aesthetic.name} · {result.match}%</li>)}</ol></div>)}</div>
      {differences.length ? <table className="axis-table"><caption>Biggest match differences</caption>
        <thead><tr><th scope="col">Aesthetic</th><th scope="col">You</th><th scope="col">Them</th></tr></thead>
        <tbody>{differences.map(item => <tr key={item.aesthetic.slug}><th scope="row">{item.aesthetic.name}</th>
          <td>{item.match}%</td><td>{item.otherMatch}%</td></tr>)}</tbody>
      </table> : <p>Your displayed match percentages are identical.</p>}
    </div>}
  </details>;
}
