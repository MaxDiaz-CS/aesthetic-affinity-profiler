import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import { chromium, type Page, type Response as BrowserResponse } from 'playwright';

const origin = 'https://cari.institute';
const indexUrl = `${origin}/aesthetics`;
const entryPath = /^\/aesthetics\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;
const cards = '#aestheticListContainer aesthetic-block';
type IndexEntry = { slug: string; start: string | null; end: string | null };

const userAgent = 'AestheticAffinityProfiler/1.0 (text-only catalog research; https://github.com/MaxDiaz-CS/aesthetic-affinity-profiler)';

function entrySlug(href: string) {
  const url = new URL(href, origin);
  return url.origin === origin ? entryPath.exec(url.pathname)?.[1] : undefined;
}

async function navigate(page: Page, url: string) {
  await delay(1500);
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) throw new Error(`Failed to load ${url} (HTTP ${response?.status()})`);
}

async function indexEntries(page: Page) {
  await navigate(page, indexUrl);
  await page.locator(cards).first().waitFor();
  const apiResponse = (response: BrowserResponse) =>
    new URL(response.url()).pathname === '/api/aesthetics';

  let expected = 0;
  let count = await page.locator(cards).count();
  do {
    await delay(1500);
    const [response] = await Promise.all([
      page.waitForResponse(apiResponse),
      page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)),
    ]);
    if (!response.ok()) throw new Error(`Index pagination failed (HTTP ${response.status()})`);
    const metadata = (await response.json()).page;
    if (!Number.isSafeInteger(metadata?.totalElements) || (expected === 0 && metadata.totalElements <= count)) {
      throw new Error('CARI index pagination returned an inconsistent count');
    }
    if (expected !== 0 && expected !== metadata.totalElements) {
      console.warn(`CARI reported ${metadata.totalElements} entries on a later page. Checking against the first page's count of ${expected}.`);
    }
    if (expected === 0) expected = metadata.totalElements;
    await page.waitForFunction(({ selector, previous }) =>
      document.querySelectorAll(selector).length > previous, { selector: cards, previous: count });
    count = await page.locator(cards).count();
  } while (count < expected);

  if (count !== expected) throw new Error(`Rendered ${count} index cards, expected ${expected}`);

  // CARI renders each entry link inside the card's open shadow root.
  await page.waitForFunction(({ selector, total }) =>
    [...document.querySelectorAll(selector)].filter(card => card.shadowRoot?.querySelector('a[href]')).length === total,
  { selector: cards, total: expected });

  const entries = await page.locator(cards).evaluateAll(blocks => blocks.map(block => {
    const card = block as HTMLElement & { startYear?: string; endYear?: string };
    return {
      href: card.shadowRoot?.querySelector<HTMLAnchorElement>('a[href]')?.href ?? '',
      start: card.getAttribute('startyear') ?? (card.startYear === '?' ? null : card.startYear ?? null),
      end: card.getAttribute('endyear') ?? (card.endYear === 'now' ? null : card.endYear ?? null),
    };
  }));
  return validateIndex(entries.map(({ href, start, end }) => ({
    slug: entrySlug(href) ?? '', start, end,
  })), expected);
}

function validateIndex(entries: IndexEntry[], expected: number) {
  const slugs = new Set(entries.map(entry => entry.slug));
  if (slugs.has('') || slugs.size !== expected || entries.length !== expected) {
    throw new Error(`Expected ${expected} distinct CARI entries, got ${slugs.size} distinct slugs in ${entries.length} rows`);
  }
  return entries.sort((a, b) => a.slug.localeCompare(b.slug, 'en'));
}

type ReadSource = (path: string, filename: string) => Promise<string>;

async function indexEntriesViaHttp(read: ReadSource) {
  const index = await read('/aesthetics', 'index.html');
  const { window } = new JSDOM(index);
  const entries: IndexEntry[] = [...window.document.querySelectorAll(cards)].map(card => ({
    slug: entrySlug(`/aesthetics/${card.getAttribute('urlslug') ?? ''}`) ?? '',
    start: card.getAttribute('startyear'),
    end: card.getAttribute('endyear'),
  }));
  window.close();

  let expected = entries.length;
  let pages = 2;
  for (let page = 1; page < pages; page++) {
    const text = await read(`/api/aesthetics?asc=true&sort=name&page=${page}`, `page-${page}.json`);
    const payload = JSON.parse(text) as {
      page: { number: number; totalElements: number; totalPages: number };
      content: Record<string, { urlSlug: string; startYear?: string; endYear?: string }[]>[];
    };
    const metadata = payload.page;
    if (metadata.number !== page || !Number.isSafeInteger(metadata.totalPages)
      || metadata.totalPages <= page || !Number.isSafeInteger(metadata.totalElements)
      || (page > 1 && metadata.totalPages !== pages)) {
      throw new Error(`Inconsistent CARI index pagination on page ${page}`);
    }
    if (page === 1) expected = metadata.totalElements;
    else if (metadata.totalElements !== expected) {
      console.warn(`CARI page ${page} reported ${metadata.totalElements} entries. Checking against the first page's count of ${expected}.`);
    }
    pages = metadata.totalPages;
    for (const group of payload.content) {
      for (const rows of Object.values(group)) {
        for (const row of rows) {
          entries.push({
            slug: entrySlug(`/aesthetics/${row.urlSlug}`) ?? '',
            start: row.startYear || null,
            end: row.endYear || null,
          });
        }
      }
    }
  }
  return validateIndex(entries, expected);
}

function extractEntry(document: Document, entry: IndexEntry) {
  const { slug } = entry;
  const url = `${indexUrl}/${slug}`;
  const header = document.querySelector('.aesthetic-header');
  if (!header) throw new Error(`Missing entry header at ${url}`);
  const clean = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() || null;
  const normalizeLabel = (text: string | null | undefined) => clean(text)?.replace(/:$/, '').toLowerCase();
  const datum = (label: string) =>
    [...header.querySelectorAll('.aesthetic-header-datum')]
      .find(row => normalizeLabel(row.firstElementChild?.textContent) === label)?.children[1];
  const value = (...labels: string[]) => {
    for (const label of labels) {
      const text = clean(datum(label)?.textContent);
      if (text) return text;
    }
    return null;
  };

  const description = header.querySelector('.description')?.cloneNode(true) as HTMLElement | undefined;
  description?.querySelector('#websitesList')?.previousElementSibling?.remove();
  description?.querySelector('#websitesList')?.remove();

  const keyMotifs = [...(description?.querySelectorAll('li') ?? [])]
    .map(item => clean(item.textContent)).filter(item => item !== null);
  description?.querySelectorAll('ul, ol').forEach(list => list.remove());

  const altNames = datum('alternate names');
  const attributedFields = [...header.querySelectorAll('aside .aesthetic-sidebar-group')]
    .find(group => normalizeLabel(group.previousElementSibling?.textContent) === 'attribution');
  const attribution = Object.fromEntries(
    [...(attributedFields?.querySelectorAll('.aesthetic-header-datum') ?? [])].flatMap(row => {
      const label = clean(row.firstElementChild?.textContent)?.replace(/:$/, '');
      const text = clean(row.children[1]?.textContent);
      return label && text && normalizeLabel(label) !== 'alternate names' ? [[label, text]] : [];
    }),
  );

  const related = [...document.querySelectorAll('.aesthetic-detail aesthetic-block[urlslug]')]
    .map(card => card.getAttribute('urlslug')).filter(item => item !== null);

  const fields = {
    name: clean(header.querySelector('h1')?.textContent),
    description: clean(description?.textContent),
    key_motifs: [...new Set(keyMotifs)],
    alt_names: [...(altNames?.querySelectorAll(':scope > span > :first-child') ?? [])]
      .map(item => clean(item.textContent)).filter(item => item !== null),
    relevant_decade: value('relevant decade', 'sorted decade'),
    timeline: value('period of relevance', 'timeline'),
    earliest_example: value('earliest known example', 'earliest example') ?? entry.start,
    end_of_popularity: value('end of popularity') ?? entry.end,
    related: [...new Set(related)],
    attribution: { source: 'Consumer Aesthetics Research Institute (CARI)', ...attribution },
  };

  if (!fields.name) throw new Error(`Missing title at ${url}`);
  return { slug, url, ...fields };
}

async function saveSnapshot(entries: IndexEntry[], loadEntry: (url: string, slug: string) => Promise<string>) {
  console.log(`Found ${entries.length} distinct CARI index entries`);
  const snapshot = [];
  for (const entry of entries) {
    const html = await loadEntry(`/aesthetics/${entry.slug}`, entry.slug);
    const { window } = new JSDOM(html);
    try {
      snapshot.push(extractEntry(window.document, entry));
    } finally {
      window.close();
    }
    console.log(`[${snapshot.length}/${entries.length}] ${entry.slug}`);
  }
  const date = new Date().toISOString().slice(0, 10);
  const output = new URL(`../data/cari_snapshot_${date}.json`, import.meta.url);
  const temporary = new URL(`${output.href}.${process.pid}.tmp`);
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
  await rename(temporary, output);
  console.log(`Saved ${snapshot.length} entries to ${output.pathname}`);
}

async function main() {
  if (process.argv.includes('--http')) {
    const archive = process.env.CARI_CAPTURE_DIRECTORY;
    const read: ReadSource = async (path, filename) => {
      if (archive) return readFile(`${archive}/${filename}`, 'utf8');
      await delay(1500);
      const response = await fetch(new URL(path, origin), {
        headers: { 'User-Agent': userAgent },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`Failed to load ${path} (HTTP ${response.status})`);
      return response.text();
    };
    await saveSnapshot(await indexEntriesViaHttp(read), (path, slug) => read(path, `${slug}.html`));
    return;
  }

  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    proxy: proxy ? { server: proxy } : undefined,
  });
  try {
    const context = await browser.newContext({
      userAgent,
      viewport: { width: 1280, height: 700 },
    });
    await context.route('**/*', route => {
      const request = route.request();
      const isGallery = /^\/api\/aesthetics\/[^/]+\/gallery(?:\/|$)/.test(new URL(request.url()).pathname);
      return ['image', 'font', 'media'].includes(request.resourceType()) || isGallery
        ? route.abort()
        : route.continue();
    });

    const page = await context.newPage();
    const entries = await indexEntries(page);
    await saveSnapshot(entries, async (path, slug) => {
      const url = new URL(path, origin).href;
      await navigate(page, url);
      if (entrySlug(page.url()) !== slug) throw new Error(`Unexpected redirect for ${url}`);
      return page.content();
    });
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
