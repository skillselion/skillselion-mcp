/** Regression for the 0.5.3 relevance work, against the LIVE catalog:
 *  1. A long natural-language query must NOT throw the catalog's HTTP-400 (the
 *     old smartFetch let an over-long `q` abort the whole load) - it loads or
 *     floors, never errors.
 *  2. The relevance floor fires on a clear no-match (a poem task) instead of
 *     returning a junk popular skill.
 *  3. A clean domain query loads a topical skill (curated-field match).
 *  Forwards env so GITHUB_TOKEN (if set) avoids GitHub rate-limit flakes. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';

const txt = (r) => (r.content || []).map((c) => c.text || '').join('\n');
const transport = new StdioClientTransport({ command: 'node', args: ['index.js'], env: { ...process.env } });
const client = new Client({ name: 'relevance', version: '0' }, { capabilities: {} });
await client.connect(transport);

const isFloor = (s) => /^No skill on Skillselion clearly matches/.test(s.trim());
const isErr = (s) => /Skillselion API \d|Provide a `query`/.test(s);

// 1) long, wordy query - must resolve to a real result, never an API-400 throw
const long = 'Set up a comprehensive Stripe Checkout payment flow in my Next.js App Router application with a server route that creates a checkout session and a client button, following current best practices';
assert.ok(long.length > 120, 'test query should exceed the API q-length limit');
const r1 = txt(await client.callTool({ name: 'load_skill', arguments: { query: long, context: 'Next.js app router, payments' } }));
assert.ok(!isErr(r1), 'long query errored instead of broadening: ' + r1.slice(0, 120));
assert.ok(/# Skill/.test(r1) || isFloor(r1), 'long query neither loaded nor floored: ' + r1.slice(0, 120));
console.log('[1] long query OK ->', isFloor(r1) ? '(floor)' : r1.split('\n')[0]);

// 2) clear no-match -> floor, not junk
const r2 = txt(await client.callTool({ name: 'load_skill', arguments: { query: 'write a haiku about autumn leaves', context: 'creative writing, no code' } }));
assert.ok(isFloor(r2), 'no-match query did not floor: ' + r2.split('\n')[0]);
console.log('[2] no-match floored OK');

// 3) clean domain query -> topical load (a testing/e2e skill)
const r3 = txt(await client.callTool({ name: 'load_skill', arguments: { query: 'playwright e2e tests', context: 'Next.js app' } }));
assert.ok(!isFloor(r3) && /# Skill/.test(r3), 'domain query failed to load: ' + r3.split('\n')[0]);
assert.ok(/test|e2e|playwright|webapp/i.test(r3.split('\n')[0]), 'domain pick not topical: ' + r3.split('\n')[0]);
console.log('[3] domain query loaded ->', r3.split('\n')[0]);

await client.close();
console.log('\n✓ relevance regression PASSED');
