import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, cleanTarget, isPrivateIp, checkSite, badge, report } from "../skills/site-check/scripts/site-check.mjs";

const full = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "permissions-policy": "camera=()",
  "set-cookie": ["a=1; Path=/; Secure; HttpOnly; SameSite=Lax"], server: "nginx",
};

test("all headers → A 100", () => {
  const r = grade(new URL("https://ex.com"), { status: 200, headers: full });
  assert.equal(r.score, 100); assert.equal(r.grade, "A");
});

test("plain http and nothing set → F", () => {
  const r = grade(new URL("http://ex.com"), { status: 200, headers: { server: "Apache/2.4.1", "x-powered-by": "PHP/8" } });
  assert.equal(r.score, 7); assert.equal(r.grade, "F"); // only «no cookies» passes
  assert.equal(r.findings.find((f) => f.id === "version").ok, false);
});

test("one cookie without HttpOnly fails the cookie check", () => {
  const r = grade(new URL("https://ex.com"), { status: 200, headers: { ...full, "set-cookie": ["a=1; Secure; HttpOnly; SameSite=Lax", "b=2; Secure; SameSite=Lax"] } });
  assert.equal(r.findings.find((f) => f.id === "cookies").ok, false); assert.equal(r.score, 93);
});

test("private, local and odd addresses are refused before any request", () => {
  for (const a of ["localhost", "127.0.0.1", "10.0.0.5", "169.254.169.254", "[::1]", "[::ffff:127.0.0.1]", "intranet", "a.local", "ex.com:8080", "ftp://ex.com", "https://u:p@ex.com", ""]) assert.equal(cleanTarget(a), null, a);
  assert.equal(cleanTarget("ex.com").href, "https://ex.com/");
  assert.ok(isPrivateIp("::ffff:7f00:1")); assert.ok(isPrivateIp("100.64.0.1")); assert.ok(!isPrivateIp("8.8.8.8"));
});

test("redirects are followed up to 3 and each hop is checked again", async () => {
  const seen = [];
  const hop = async (u) => { seen.push(u.href); return u.hostname === "ex.com" ? { status: 301, headers: { location: "http://127.0.0.1/" } } : { status: 200, headers: {} }; };
  assert.deepEqual(await checkSite("ex.com", hop), { error: "bad_address" });
  assert.deepEqual(seen, ["https://ex.com/"]);
  let n = 0;
  const loop = async () => { n++; return { status: 302, headers: { location: "https://ex.com/next" } }; };
  const r = await checkSite("ex.com", loop);
  assert.equal(n, 4); assert.equal(r.status, 302);
});

test("badge states what was measured and links back", () => {
  const r = grade(new URL("https://ex.com"), { status: 200, headers: full });
  const b = badge(r);
  assert.match(b, /Security headers: A \(100\/100\)/);
  assert.match(b, /img\.shields\.io\/badge\/security%20headers-A%20\(100%2F100\)-brightgreen/);
  assert.match(b, /unchore\.ai\/tools\/site-check\?utm_source=badge/);
  assert.match(report(r), /checks response headers only/);
});

test("the site-check-only plugin carries the same script", async () => {
  const { readFileSync } = await import("node:fs");
  const u = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.equal(u("../plugins/site-check/skills/site-check/scripts/site-check.mjs"), u("../skills/site-check/scripts/site-check.mjs"));
});
