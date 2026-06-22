/**
 * Smoke test: start the server over stdio, connect a real MCP client, and assert
 * it exposes the expected tools. Deterministic - does not call the live catalog
 * API, so CI never flakes on network.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';

const transport = new StdioClientTransport({ command: 'node', args: ['index.js'] });
const client = new Client({ name: 'smoke', version: '0' }, { capabilities: {} });

await client.connect(transport);
const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
assert.deepEqual(names, ['load_skill', 'search_skillselion', 'top_skillselion'], `unexpected tools: ${names}`);
for (const t of tools) assert.ok(t.description?.length > 20, `tool ${t.name} missing description`);
await client.close();

console.log(`✓ smoke passed - server starts and exposes: ${names.join(', ')}`);
