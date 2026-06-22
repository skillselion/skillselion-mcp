/** Regression: the exact verbose query the dog-food agent used must now resolve
 *  to the mcp-builder skill (not junk, not an error). Runs the real server. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';

const txt = (r) => (r.content || []).map((c) => c.text || '').join('\n');
const transport = new StdioClientTransport({ command: 'node', args: ['index.js'] });
const client = new Client({ name: 'verbose', version: '0' }, { capabilities: {} });
await client.connect(transport);

const Q = 'build MCP server python best practices';

const s = await client.callTool({ name: 'search_skillselion', arguments: { query: Q, type: 'skill', limit: 5 } });
const so = txt(s);
console.log('[search] ' + so.split('\n')[0]);
assert.ok(!/No Skillselion results/.test(so), 'verbose search returned nothing');

const l = await client.callTool({ name: 'load_skill', arguments: { query: Q, context: 'building an MCP server in Python, want current best practices' } });
const lo = txt(l);
console.log('[load_skill] ' + lo.split('\n')[0]);
assert.ok(!/Provide a skill|No skill matched/.test(lo), 'verbose load_skill failed: ' + lo.slice(0, 120));
assert.ok(/Skill loaded|# Skill:/.test(lo), 'verbose load_skill did not load a skill');
// relevance: an MCP-building query must pick an MCP-related skill, not a high-
// install but unrelated one (the azure-aigateway regression).
assert.ok(/mcp/i.test(lo.split('\n')[0]), 'load_skill picked an irrelevant skill: ' + lo.split('\n')[0]);
// scored alternates should be surfaced (not a silent single pick).
assert.ok(/Other candidates/.test(lo), 'load_skill did not surface alternate candidates');
// required-context: calling WITHOUT context must be refused (throw OR an error
// message asking for context), not silently load.
let needsCtx = false;
try { const nr = await client.callTool({ name: 'load_skill', arguments: { query: Q } }); needsCtx = nr.isError === true || /context|required|invalid/i.test(txt(nr)); }
catch { needsCtx = true; }
assert.ok(needsCtx, 'load_skill did not require context');

await client.close();
console.log('\n✓ verbose-query regression PASSED');
