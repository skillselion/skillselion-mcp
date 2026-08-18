/**
 * Smoke test: start the server over stdio, connect a real MCP client, and assert
 * it exposes the expected tools. Deterministic - does not call the live catalog
 * API, so CI never flakes on network.
 *
 * Two launch paths: `node index.js` (what this repo's tests used) and a temp
 * symlink that mirrors npm's `.bin/skillselion-mcp` (what Cursor/`npx` spawn).
 * 0.9.7's entry check passed the first and silently skipped runServer on the second.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED = ['load_skill', 'search_skillselion', 'synthesize_skills', 'top_skillselion'];
const indexJs = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.js');

async function assertTools(command, args, label) {
  const transport = new StdioClientTransport({ command, args });
  const client = new Client({ name: 'smoke', version: '0' }, { capabilities: {} });
  await client.connect(transport);
  const info = client.getServerVersion();
  assert.equal(info?.name, 'skillselion', `${label}: unexpected server name`);
  assert.equal(info?.title, 'Skillselion', `${label}: missing title`);
  assert.equal(info?.websiteUrl, 'https://skillselion.com', `${label}: missing websiteUrl`);
  const icon = info?.icons?.[0];
  assert.equal(icon?.src, 'https://skillselion.com/icon.png', `${label}: missing brand icon`);
  assert.equal(icon?.mimeType, 'image/png', `${label}: icon mimeType`);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, EXPECTED, `${label}: unexpected tools: ${names}`);
  for (const t of tools) assert.ok(t.description?.length > 20, `${label}: tool ${t.name} missing description`);
  await client.close();
  console.log(`✓ smoke (${label}) - ${names.join(', ')}`);
}

await assertTools(process.execPath, [indexJs], 'node index.js');

const dir = mkdtempSync(join(tmpdir(), 'skillselion-bin-'));
const bin = join(dir, 'skillselion-mcp');
symlinkSync(indexJs, bin);
try {
  await assertTools(process.execPath, [bin], 'npx-style bin symlink');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
