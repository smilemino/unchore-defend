import { test } from "node:test";
import assert from "node:assert/strict";
import { mask, isRefusal, CHAIN, ask } from "../skills/unchore-defend/scripts/defend.mjs";

test("personal data and secrets are masked, evidence is kept", () => {
  const { text, hits } = mask("from 203.0.113.9 at /login user a.b@ex.com phone 010-1234-5678 key sk-abcdefghijklmnop card 4111 1111 1111 1111");
  assert.equal(hits, 4);
  assert.match(text, /203\.0\.113\.9/); assert.match(text, /\/login/);
  assert.doesNotMatch(text, /a\.b@ex\.com|1234-5678|sk-abc|4111/);
});

test("private keys are masked but the markers stay", () => {
  const k = "PRIVATE " + "KEY-----"; // split so secret scanners don't flag this fake key
  const { text } = mask(`-----BEGIN RSA ${k}\nMIIabc\n-----END RSA ${k}`);
  assert.match(text, /BEGIN RSA PRIVATE KEY-----\s*\[secret masked\]/); assert.doesNotMatch(text, /MIIabc/);
});

test("refusals are recognised, long answers are not", () => {
  assert.ok(isRefusal("I'm sorry, but I can't help with that."));
  assert.ok(isRefusal(""));
  assert.ok(!isRefusal("Yes — this is SQL injection. " + "x".repeat(700)));
  assert.deepEqual(Object.keys(CHAIN), ["claude", "gpt", "glm", "deepseek"]);
});

test("a provider content filter counts as a refusal; running out of room is an error, not a refusal", async () => {
  const real = globalThis.fetch;
  const reply = (choice) => async () => new Response(JSON.stringify({ choices: [choice], usage: { cost: 0.001 } }), { status: 200 });
  try {
    globalThis.fetch = reply({ finish_reason: "content_filter", message: { content: null } });
    assert.deepEqual([(await ask("claude", "k", "x")).status, (await ask("claude", "k", "x")).why], ["refused", "content filter"]);
    globalThis.fetch = reply({ finish_reason: "length", message: { content: "" } });
    assert.equal((await ask("glm", "k", "x")).status, "error");
    globalThis.fetch = reply({ finish_reason: "stop", message: { content: "This is a C2 polling agent. ".repeat(30) } });
    assert.equal((await ask("gpt", "k", "x")).status, "ok");
  } finally { globalThis.fetch = real; }
});
