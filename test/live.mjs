/**
 * LIVE end-to-end test: launches the server over stdio (exactly as Claude Code
 * would), calls every tool against the REAL catalog + GitHub, and proves the
 * dynamic skill-loading materializes a full MULTI-FILE skill dir to disk.
 * Reads the temp path from the tool's own output (robust to TMPDIR differences).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const line = (s = '') => console.log(s);
const txt = (r) => (r.content || []).map((c) => c.text || '').join('\n');

// Forward the parent env so the server picks up GITHUB_TOKEN (raises the GitHub
// rate limit 60->5000/hr); without it the tree API can 403 and the multi-file
// materialize assertion flakes under repeated runs.
const transport = new StdioClientTransport({ command: 'node', args: ['index.js'], env: { ...process.env } });
const client = new Client({ name: 'live', version: '0' }, { capabilities: {} });
await client.connect(transport);

const { tools } = await client.listTools();
line('TOOLS: ' + tools.map((t) => t.name).join(', '));

// search
line('\n[1] search_skillselion("playwright", limit:2)');
line(txt(await client.callTool({ name: 'search_skillselion', arguments: { query: 'playwright', limit: 2 } })).slice(0, 500));

// load a MULTI-FILE skill by explicit id (mcp-builder bundles reference/*.md)
const ID = 'skill:anthropics/skills#mcp-builder';
line('\n[2] load_skill("' + ID + '")  - expect SKILL.md + bundled reference files');
const l = await client.callTool({ name: 'load_skill', arguments: { id: ID, context: 'building an MCP server, want the canonical reference skill' } });
const out = txt(l);
const path = (out.match(/Local copy:\s*(\S+)/) || [])[1];
line('   reported Local copy: ' + path);
line('   --- bundled-files section the tool returned ---');
line('   ' + (out.split('## Bundled files')[1] || '(none)').slice(0, 400).replace(/\n/g, '\n   '));

// DISK PROOF at the path the tool actually used
line('\n[3] DISK PROOF - walking ' + path);
const found = [];
function walk(dir, depth = 0) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { line('   '.repeat(depth) + '- ' + name + '/'); walk(p, depth + 1); }
    else { line('   '.repeat(depth) + '- ' + name + '  (' + st.size + 'b)'); found.push(name); }
  }
}
assert.ok(path && existsSync(path), 'temp dir does not exist: ' + path);
walk(path);

// assertions: SKILL.md + at least one bundled reference file landed on disk
assert.ok(found.includes('SKILL.md'), 'SKILL.md not materialized');
assert.ok(found.length >= 2, 'expected bundled files beyond SKILL.md, got: ' + found.join(', '));
line('\n   ✓ ' + found.length + ' files materialized incl. SKILL.md + bundled refs');

await client.close();
line('\nLIVE TEST PASSED');
