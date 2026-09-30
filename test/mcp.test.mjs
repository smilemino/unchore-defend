import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, TOOLS } from "../mcp/server.mjs";

test("initialize, list and errors follow JSON-RPC", async () => {
  const init = await handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  assert.equal(init.result.protocolVersion, "2025-06-18"); assert.ok(init.result.capabilities.tools);
  assert.equal(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  const list = await handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.deepEqual(list.result.tools.map((t) => t.name), TOOLS.map((t) => t.name));
  assert.equal((await handle({ jsonrpc: "2.0", id: 3, method: "nope" })).error.code, -32601);
  assert.equal((await handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "nope" } })).error.code, -32602);
});

test("site_check refuses a private address without a request", async () => {
  const r = await handle({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "site_check", arguments: { url: "169.254.169.254" } } });
  assert.equal(r.result.isError, true);
});

test("defend_analyze without a key says how to get one", async () => {
  const env = { ...process.env }; delete process.env.UNCHORE_TOKEN; delete process.env.OPENROUTER_API_KEY;
  try {
    const r = await handle({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "defend_analyze", arguments: { question: "hi" } } });
    assert.equal(r.result.isError, true); assert.match(r.result.content[0].text, /UNCHORE_TOKEN|OPENROUTER_API_KEY/);
  } finally { Object.assign(process.env, env); }
});
