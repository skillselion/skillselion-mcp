/**
 * Remote-mode smoke test: start `index.js http`, connect over Streamable HTTP,
 * and assert the tool list (incl. read_skill_file), read-only annotations, the
 * health route and CORS preflight. Offline - never calls the live catalog.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED = ['load_skill', 'read_skill_file', 'search_skillselion', 'synthesize_skills', 'top_skillselion'];
const indexJs = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.js');
const port = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const proc = spawn(process.execPath, [indexJs, 'http'], { env: { ...process.env, PORT: String(port), SK_NO_DEMAND: '1' }, stdio: ['ignore', 'ignore', 'pipe'] });

try {
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('http server did not start')), 8000);
    proc.stderr.on('data', (d) => { if (String(d).includes('running (http)')) { clearTimeout(t); ok(); } });
  });
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.ok, true);
  const pre = await fetch(`${base}/mcp`, { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  assert.equal((await fetch(`${base}/mcp`)).status, 405, 'GET /mcp must be 405 on a stateless server');

  const client = new Client({ name: 'http-smoke', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  assert.equal(client.getServerVersion()?.name, 'skillselion');
  assert.match(client.getInstructions() || '', /read_skill_file/, 'remote instructions must point at read_skill_file');
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), EXPECTED);
  for (const t of tools) {
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name}: readOnlyHint`);
    assert.equal(t.annotations?.destructiveHint, false, `${t.name}: destructiveHint`);
    assert.ok(t.annotations?.title, `${t.name}: title`);
  }
  await client.close();
  console.log(`http smoke: ok (${tools.length} tools, all read-only annotated)`);
} finally {
  proc.kill();
}
