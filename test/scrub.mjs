// test/scrub.mjs
import assert from 'node:assert';
import { scrubQuery } from '../index.js';

// Token fixture uses >=4 chars after the prefix to match the server's TOKEN
// regex quantifier {4,} (apps/api/src/mcp/scrub.ts) - the shared contract.
const out = scrubQuery('fix sk-ABC123 for bob@x.io in /Users/bob/a/b.ts ```code``` stripe webhook');
assert(!/sk-ABC123/.test(out), 'token stripped');
assert(!/bob@x\.io/.test(out), 'email stripped');
assert(!/\/Users\/bob/.test(out), 'path stripped');
assert(out.includes('stripe webhook'), 'intent kept');
assert(scrubQuery('a'.repeat(500)).length <= 200, 'capped');
console.log('scrub ok');
