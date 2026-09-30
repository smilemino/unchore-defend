#!/usr/bin/env node
// Unchore site check — one GET of a public web address, then its security headers and cookie flags read out plainly,
// a 0–100 score, a letter (A–F) and a README badge. No install, no account, nothing sent anywhere but the site itself.
// Same scoring as https://unchore.ai/tools/site-check.
// Safety: only http/https on ports 80/443, the address must resolve to a public IP (checked at connect time, so a name
// can't switch to an inside address between the check and the request), at most 3 redirects, 8 s, 200 KB read.
import { lookup as dnsLookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

/** Loopback, private, link-local, carrier NAT, multicast, reserved and the cloud metadata address — never fetched. */
export function isPrivateIp(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const x = ip.toLowerCase();
  // An IPv4 address inside IPv6 (::ffff:127.0.0.1, ::ffff:7f00:1, ::127.0.0.1, 64:ff9b::7f00:1) is judged as that IPv4 address.
  const tail = /^(?:::(?:ffff:)?|64:ff9b::)(.+)$/.exec(x)?.[1];
  if (tail) {
    if (isIP(tail) === 4) return isPrivateIp(tail);
    const h = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
    if (h) { const a = parseInt(h[1], 16), b = parseInt(h[2], 16); return isPrivateIp(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`); }
  }
  return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb") || x.startsWith("ff") || x.startsWith("64:ff9b");
}

/** A typed web address → a URL we may fetch, or null. */
export function cleanTarget(raw) {
  let s = String(raw ?? "").trim();
  if (!s || s.length > 300) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  if (u.port && !["80", "443"].includes(u.port)) return null;
  const h = u.hostname.toLowerCase();
  if ((!h.includes(".") && !h.startsWith("[")) || h.endsWith(".local") || h.endsWith(".internal") || h === "localhost") return null;
  // Addresses typed as numbers skip the name lookup that checks them at connect time: only a public IPv4 number is allowed.
  const bare = h.replace(/^\[|\]$/g, "");
  if (isIP(bare) === 6 || (isIP(bare) === 4 && isPrivateIp(bare))) return null;
  return u;
}

/** One request; the name is resolved inside the connection and refused if it points inside. */
function once(u) {
  return new Promise((ok, fail) => {
    const safeLookup = (host, opts, cb) => {
      dnsLookup(host, { all: true }, (err, list) => {
        if (err) return cb(err, "", 4);
        if (!list.length || list.some((a) => isPrivateIp(a.address))) return cb(Object.assign(new Error("not a public address"), { code: "EPRIVATE" }), "", 4);
        if (opts?.all) return cb(null, list);
        cb(null, list[0].address, list[0].family);
      });
    };
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(u, { method: "GET", lookup: safeLookup, timeout: 8000, headers: { "user-agent": "UnchoreSiteCheck/1.0 (+https://unchore.ai/tools/site-check)", accept: "text/html,*/*" } }, (res) => {
      let n = 0;
      const done = () => ok({ status: res.statusCode ?? 0, headers: res.headers });
      res.on("data", (c) => { n += c.length; if (n > 200_000) res.destroy(); });
      res.on("end", done); res.on("close", done); res.on("error", done);
    });
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", fail);
    req.end();
  });
}

/** Follow up to 3 redirects (each hop checked again), then read the headers. */
export async function checkSite(raw, fetchOnce = once) {
  let u = cleanTarget(raw);
  if (!u) return { error: "bad_address" };
  let got = null;
  for (let hop = 0; hop < 4; hop++) {
    try { got = await fetchOnce(u); } catch { return { error: "unreachable" }; }
    const loc = got.headers.location;
    if (got.status >= 300 && got.status < 400 && loc && hop < 3) {
      const next = cleanTarget(new URL(String(loc), u).toString());
      if (!next) return { error: "bad_address" };
      u = next;
      continue;
    }
    break;
  }
  return grade(u, got);
}

const has = (h, k) => h[k] !== undefined && String(h[k]).trim() !== "";

/** The headers → findings, a 0–100 score and a letter. Pure (tests feed it headers). */
export function grade(u, g) {
  const h = g.headers;
  const cookies = [].concat(h["set-cookie"] ?? []);
  const csp = String(h["content-security-policy"] ?? "");
  const f = [
    { id: "https", ok: u.protocol === "https:", weight: 25 },
    { id: "hsts", ok: u.protocol === "https:" && /max-age=\d{6,}/i.test(String(h["strict-transport-security"] ?? "")), weight: 15 },
    { id: "csp", ok: csp.length > 0, weight: 15 },
    { id: "frames", ok: /frame-ancestors/i.test(csp) || /^(deny|sameorigin)$/i.test(String(h["x-frame-options"] ?? "").trim()), weight: 10 },
    { id: "nosniff", ok: /nosniff/i.test(String(h["x-content-type-options"] ?? "")), weight: 10 },
    { id: "referrer", ok: has(h, "referrer-policy"), weight: 8 },
    { id: "permissions", ok: has(h, "permissions-policy"), weight: 5 },
    { id: "cookies", ok: cookies.every((c) => /;\s*secure/i.test(c) && /;\s*httponly/i.test(c) && /;\s*samesite=/i.test(c)), weight: 7 },
    { id: "version", ok: !/\d/.test(String(h.server ?? "")) && !has(h, "x-powered-by"), weight: 5 },
  ];
  const score = f.reduce((s, x) => s + (x.ok ? x.weight : 0), 0);
  const letter = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  return { url: u.toString(), status: g.status, https: u.protocol === "https:", findings: f, score, grade: letter, server: h.server ? String(h.server).slice(0, 60) : undefined };
}

/** What each check means and the one-line fix. */
export const TEXT = {
  https: ["Served over HTTPS", "Serve the site over HTTPS only and redirect http:// to https://."],
  hsts: ["HSTS (browsers stay on HTTPS)", "Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`."],
  csp: ["Content-Security-Policy set", "Add a Content-Security-Policy; start with `default-src 'self'` and allow only what the page needs."],
  frames: ["Can't be framed by other sites (clickjacking)", "Add `frame-ancestors 'none'` to the CSP, or `X-Frame-Options: DENY`."],
  nosniff: ["No MIME sniffing", "Add `X-Content-Type-Options: nosniff`."],
  referrer: ["Referrer-Policy set", "Add `Referrer-Policy: strict-origin-when-cross-origin`."],
  permissions: ["Permissions-Policy set", "Add `Permissions-Policy: camera=(), microphone=(), geolocation=()` (allow only what you use)."],
  cookies: ["Cookies are Secure, HttpOnly and SameSite", "Give every Set-Cookie `Secure; HttpOnly; SameSite=Lax` (or Strict)."],
  version: ["Server software/version not exposed", "Remove `X-Powered-By` and version numbers from the `Server` header."],
};

const COLOR = { A: "brightgreen", B: "green", C: "yellow", D: "orange", F: "red" };
const PAGE = "https://unchore.ai/tools/site-check";

/** Markdown for a README badge. It only states what was measured: security headers, on this date. */
export function badge(r) {
  const msg = encodeURIComponent(`${r.grade} (${r.score}/100)`).replace(/-/g, "--");
  const img = `https://img.shields.io/badge/security%20headers-${msg}-${COLOR[r.grade]}`;
  return `[![Security headers: ${r.grade} (${r.score}/100) — checked with Unchore](${img})](${PAGE}?utm_source=badge&utm_campaign=site-check)`;
}

export function report(r, when = new Date()) {
  const lines = [`${r.url} → ${r.grade} (${r.score}/100) · HTTP ${r.status} · checked ${when.toLocaleDateString("en-CA")}`, ""];
  for (const x of r.findings) lines.push(`${x.ok ? "✓" : "✗"} ${TEXT[x.id][0]}${x.ok ? "" : ` (−${x.weight}) — fix: ${TEXT[x.id][1]}`}`);
  lines.push("", "Badge for your README (it only claims what was measured):", badge(r), "",
    "This checks response headers only — not your code, logins or servers. To read logs or a suspicious file, use Unchore Defend.");
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const target = args.find((a) => !a.startsWith("--"));
  if (!target) { console.error("usage: node scripts/site-check.mjs <site address> [--json]"); process.exit(2); }
  const r = await checkSite(target);
  if ("error" in r) {
    console.error(r.error === "bad_address" ? "That address can't be checked (only public http/https sites on ports 80/443)." : "The site didn't answer within 8 seconds.");
    process.exit(1);
  }
  console.log(json ? JSON.stringify({ ...r, badge: badge(r) }, null, 1) : report(r));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
