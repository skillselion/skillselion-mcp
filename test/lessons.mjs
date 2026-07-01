import assert from 'node:assert';
import { applyLessons } from '../index.js';

const ranked = [
  { id: 'a/b#wine', score: 9, qStrong: 2 },
  { id: 'c/d#dba', score: 4, qStrong: 0 },
];
const lessons = [{ queryShape: 'dba retirement', blockListingId: 'a/b#wine', preferListingId: 'c/d#dba', status: 'active', note: 'off-topic' }];
const out = applyLessons('best wine for a dba retirement', ranked, lessons);
assert(out[0].id === 'c/d#dba', 'preferred listing rises to top');
console.log('lessons ok');
