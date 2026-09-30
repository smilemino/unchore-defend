import { test } from "node:test";
import assert from "node:assert/strict";
import { mask, isRefusal, CHAIN } from "../skills/unchore-defend/scripts/defend.mjs";

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
