/** Labeled relevance eval for load_skill against the LIVE catalog.
 *
 *  Runs a fixed query set through load_skill and scores each result against an
 *  expected pattern (or `floor: true` for no-match cases). Prints a hit-rate so
 *  the SAME harness can be run BEFORE and AFTER the hybrid-semantic change to
 *  measure the lift. Run several times (catalog + network add variance):
 *      node test/eval.mjs           # one pass
 *      node test/eval.mjs 3         # 3 passes, prints mean hit-rate
 *
 *  The CASES marked `semantic:true` are the ones keyword matching struggles with
 *  (the concept is worded differently than any skill's curated text) - watch
 *  those flip from miss→hit once embeddings are live. Forwards env so a
 *  GITHUB_TOKEN avoids GitHub rate-limit flakes.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const txt = (r) => (r.content || []).map((c) => c.text || '').join('\n');
const firstLine = (s) => s.split('\n').find((l) => l.trim()) || '';
const isFloor = (s) => /^No skill on Skillselion clearly matches/.test(s.trim());

// expect: regex the loaded skill's first line (`# Skill loaded: <slug> (<repo>)`)
// must match. floor: true => the query SHOULD return the no-match floor.
// semantic: true => a keyword-hostile query where embeddings should help most.
const CASES = [
  // --- clean keyword cases (should already pass; guard against regressions) ---
  { query: 'playwright e2e tests', context: 'Next.js app, end-to-end testing', expect: /playwright|e2e|test|webapp/i },
  { query: 'build an MCP server in python', context: 'python, model context protocol', expect: /mcp|server/i },
  { query: 'stripe checkout payment flow', context: 'Next.js app router, payments', expect: /stripe|payment|checkout/i },
  { query: 'react performance optimization', context: 'React app, slow renders', expect: /react|perf|render/i },
  { query: 'dockerfile best practices', context: 'containerize a node service', expect: /docker|container/i },
  { query: 'github actions ci pipeline', context: 'automate tests on push', expect: /github|action|ci|workflow|deploy/i },
  { query: 'postgres database schema design', context: 'relational modeling', expect: /postgres|sql|database|schema/i },
  { query: 'tailwind css design system', context: 'frontend styling', expect: /tailwind|css|design|frontend|ui/i },

  // --- semantic / concept cases (keyword often misses these) ---
  { query: 'react to database row changes in real time', context: 'postgres, background worker reacting to inserts', expect: /listen|notify|pub.?sub|realtime|event|trigger|stream|webhook/i, semantic: true },
  { query: 'make my web page load faster', context: 'slow first paint, web vitals', expect: /perf|lcp|vitals|speed|optimi|lighthouse/i, semantic: true },
  { query: 'stop people from abusing my API', context: 'public endpoint getting hammered', expect: /rate.?limit|throttle|abuse|security|firewall|ddos/i, semantic: true },
  { query: 'let users sign in with their google account', context: 'web app login', expect: /auth|oauth|login|sign.?in|identity/i, semantic: true },
  { query: 'turn a long document into a short summary', context: 'LLM text processing', expect: /summar|llm|ai|nlp|text|extract/i, semantic: true },
  { query: 'keep secrets out of my git repo', context: 'accidentally committed an API key', expect: /secret|env|credential|vault|gitignore|security/i, semantic: true },
  { query: 'ship code to production safely', context: 'deploy without breaking prod', expect: /deploy|release|ci|cd|rollback|ship/i, semantic: true },
  { query: 'find and fix a memory leak', context: 'node process growing unbounded', expect: /memory|leak|profil|heap|debug|perf/i, semantic: true },

  // --- floor negatives (must NOT load a junk skill) ---
  { query: 'write a haiku about autumn leaves', context: 'creative writing, no code', floor: true },
  { query: 'what is the weather like in tokyo today', context: 'casual question, no code', floor: true },
];

async function runPass(client) {
  let hits = 0;
  const misses = [];
  for (const c of CASES) {
    const out = txt(await client.callTool({ name: 'load_skill', arguments: { query: c.query, context: c.context } }));
    let ok;
    if (c.floor) ok = isFloor(out);
    else ok = !isFloor(out) && /# Skill/.test(out) && c.expect.test(firstLine(out));
    if (ok) hits += 1;
    else misses.push(`${c.semantic ? '[sem] ' : c.floor ? '[floor] ' : ''}"${c.query}" -> ${c.floor ? '(did not floor) ' : ''}${firstLine(out).slice(0, 80)}`);
  }
  return { hits, total: CASES.length, misses };
}

const passes = Math.max(1, parseInt(process.argv[2] || '1', 10));
const transport = new StdioClientTransport({ command: 'node', args: ['index.js'], env: { ...process.env } });
const client = new Client({ name: 'eval', version: '0' }, { capabilities: {} });
await client.connect(transport);

const rates = [];
for (let p = 1; p <= passes; p++) {
  const { hits, total, misses } = await runPass(client);
  const rate = ((hits / total) * 100).toFixed(1);
  rates.push(hits / total);
  console.log(`\n=== pass ${p}/${passes}: ${hits}/${total} (${rate}%) ===`);
  if (misses.length) console.log('misses:\n  ' + misses.join('\n  '));
}
await client.close();

const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
console.log(`\n>>> mean hit-rate over ${passes} pass(es): ${(mean * 100).toFixed(1)}%  (${CASES.length} cases: ${CASES.filter((c) => c.semantic).length} semantic, ${CASES.filter((c) => c.floor).length} floor)`);
