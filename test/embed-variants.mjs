/**
 * Offline A/B/C experiment: does embedding RICHER skill text improve retrieval?
 *
 * Faithfully approximates full-catalog semantic ranking WITHOUT re-embedding the
 * whole catalog or rebuilding HNSW. For each eval query we pull its real semantic
 * competitive neighborhood from prod, re-embed that corpus under each text variant,
 * and measure (brute-force cosine, in-memory) whether a RELEVANT skill ranks top-K.
 *
 *   A = current shipped fields (name+tool+category+highlights+keywords+summary+description)
 *   B = A + query-shaped enrichment (taskQueries, useCase, invokeWhen, problemStatement,
 *       answerDefinition, semanticTags, outcomeStatement, bestFor)
 *   C = B + the full SKILL.md body (fetched from GitHub raw)
 *
 * Usage: OPENAI_API_KEY=... node test/embed-variants.mjs [A,B  | A,B,C]
 * Relevance label per query = catalog skills whose name/category match the eval
 * case's `expect` regex (floor cases are skipped — this measures recall, not floor).
 */
import { readFileSync, existsSync } from 'node:fs';

const API = 'https://skillselion.com/api/upstream';
const VARIANTS = (process.argv[2] || 'A,B').split(',').map((s) => s.trim().toUpperCase());
const KEY = process.env.OPENAI_API_KEY || (() => {
  for (const p of ['/Users/itzik.dabush/Desktop/root/prism/apps/api/.env']) {
    if (existsSync(p)) { const m = readFileSync(p, 'utf8').match(/^OPENAI_API_KEY=(.+)$/m); if (m) return m[1].trim(); }
  }
  return '';
})();
if (!KEY) { console.error('no OPENAI_API_KEY'); process.exit(1); }
const GH = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embed(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 256) {
    const batch = texts.slice(i, i + 256).map((t) => (t && t.trim() ? t.slice(0, 8000) : ' '));
    for (let attempt = 1; ; attempt++) {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: batch }),
      });
      if (res.ok) { const j = await res.json(); for (const d of j.data) out[i + d.index] = d.embedding; break; }
      if ((res.status === 429 || res.status >= 500) && attempt < 6) { await sleep(2 ** attempt * 500); continue; }
      throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 120)}`);
    }
    process.stderr.write(`  embedded ${Math.min(i + 256, texts.length)}/${texts.length}\r`);
  }
  process.stderr.write('\n');
  return out;
}

const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na) * Math.sqrt(nb)); };

function buildText(r, variant) {
  const base = [r.name, r.tool, r.category, (r.highlights || []).join('. '), (r.keywords || []).join(', '), r.summary, r.description];
  if (variant === 'A') return base.filter(Boolean).join('\n').slice(0, 8000);
  const rich = [...base,
    (r.taskQueries || []).join('. '), r.useCase, r.invokeWhen, r.problemStatement,
    r.answerDefinition, (r.semanticTags || []).join(', '), r.outcomeStatement, r.bestFor];
  if (variant === 'B') return rich.filter(Boolean).join('\n').slice(0, 8000);
  // C: append the SKILL.md body (added at fetch time as r._skillmd)
  return [...rich, r._skillmd].filter(Boolean).join('\n').slice(0, 8000);
}

const enc = (s) => encodeURIComponent(s);
async function getJson(url) { const res = await fetch(url, { headers: { 'user-agent': 'skillselion-embed-ab' } }); if (!res.ok) throw new Error(`${res.status}`); const d = await res.json(); return Array.isArray(d) ? d : (d.data || d.items || []); }

async function fetchSkillMd(repo, id) {
  const slug = id.includes('#') ? id.slice(id.indexOf('#') + 1) : '';
  const paths = slug ? [`skills/${slug}/SKILL.md`, `${slug}/SKILL.md`, 'SKILL.md'] : ['SKILL.md'];
  for (const br of ['main', 'master']) for (const p of paths) {
    try { const res = await fetch(`https://raw.githubusercontent.com/${repo}/${br}/${p}`, { headers: GH ? { authorization: `Bearer ${GH}` } : {} }); if (res.ok) return (await res.text()).slice(0, 12000); } catch {}
  }
  return '';
}

// ---- load eval cases ----
const cases = JSON.parse(readFileSync(new URL('./eval-cases.json', import.meta.url).pathname, 'utf8'))
  .filter((c) => !c.floor && c.query && c.expect);
console.error(`${cases.length} non-floor eval queries`);

// ---- build the competitive corpus from prod (sequential, gentle) ----
const corpus = new Map(); // id -> row
const perQuery = []; // { query, relevantIds:Set }
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  let rows = [];
  try { rows = await getJson(`${API}/listings?semantic=${enc(c.query)}&type=skill&limit=25`); } catch (e) { console.error(`  q${i} fetch fail: ${e.message}`); }
  const re = new RegExp(c.expect, 'i');
  const relevantIds = new Set();
  for (const r of rows) {
    if (!corpus.has(r.id)) corpus.set(r.id, r);
    if (re.test(`${r.name} ${r.category}`)) relevantIds.add(r.id);
  }
  perQuery.push({ query: c.query, relevantIds });
  process.stderr.write(`  corpus build ${i + 1}/${cases.length} (corpus=${corpus.size})\r`);
  await sleep(120); // gentle on the 1GB prod DB
}
process.stderr.write('\n');
const rows = [...corpus.values()];
const usable = perQuery.filter((q) => q.relevantIds.size > 0);
console.error(`corpus=${rows.length} skills · ${usable.length}/${cases.length} queries have a gold skill in-corpus`);

// ---- embed queries once ----
console.error('embedding queries...');
const qVecs = await embed(usable.map((q) => q.query));

// ---- per-variant: embed corpus, rank, score hit@1 / hit@5 ----
const results = {};
for (const V of VARIANTS) {
  if (V === 'C') { console.error('fetching SKILL.md for variant C...'); for (let i = 0; i < rows.length; i++) { rows[i]._skillmd = await fetchSkillMd(rows[i].repo, rows[i].id); if (i % 50 === 0) process.stderr.write(`  md ${i}/${rows.length}\r`); } process.stderr.write('\n'); }
  console.error(`embedding corpus under variant ${V}...`);
  const cVecs = await embed(rows.map((r) => buildText(r, V)));
  const idIndex = rows.map((r) => r.id);
  let hit1 = 0, hit5 = 0;
  for (let qi = 0; qi < usable.length; qi++) {
    const q = usable[qi];
    const scored = cVecs.map((v, j) => [idIndex[j], cos(qVecs[qi], v)]).sort((a, b) => b[1] - a[1]);
    if (q.relevantIds.has(scored[0][0])) hit1++;
    if (scored.slice(0, 5).some(([id]) => q.relevantIds.has(id))) hit5++;
  }
  results[V] = { hit1: (100 * hit1 / usable.length).toFixed(1), hit5: (100 * hit5 / usable.length).toFixed(1) };
  console.error(`variant ${V}: hit@1=${results[V].hit1}%  hit@5=${results[V].hit5}%`);
}

console.log('\n=== EMBEDDING TEXT A/B/C — retrieval over the competitive corpus ===');
console.log(`queries scored: ${usable.length} · corpus: ${rows.length} skills`);
for (const V of VARIANTS) console.log(`  Variant ${V}:  hit@1 ${results[V].hit1}%   hit@5 ${results[V].hit5}%`);
