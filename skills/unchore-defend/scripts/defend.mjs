#!/usr/bin/env node
// Unchore Defend — security analysis for defenders. Masks personal data and secrets, then asks Claude → GPT → GLM → DeepSeek,
// moving on only when an AI refuses. Pays with Unchore credit (UNCHORE_TOKEN) or your own OpenRouter key (OPENROUTER_API_KEY).
// Same masking and refusal rules as Unchore's server (lib/defend.ts; tests/defend.test.ts keeps them equal).
import { readFileSync } from "node:fs";
import REFUSAL_WORDS from "./refusal-words.json" with { type: "json" };

const OPENROUTER_US = "https://us.openrouter.ai/api/v1/chat/completions";
const US_HOSTS = ["fireworks", "together", "deepinfra", "baseten"];
export const CHAIN = {
  claude: { model: "anthropic/claude-opus-5.5" },
  gpt: { model: "openai/gpt-6-astra" },
  // Thinking models spend part of the budget on reasoning; with 2,500 they can return an empty answer.
  glm: { model: "z-ai/glm-5.3", only: US_HOSTS, maxTokens: 12000 },
  deepseek: { model: "deepseek/deepseek-v4.1-flash", only: US_HOSTS, maxTokens: 8000 },
};
const ORDER = ["claude", "gpt", "glm", "deepseek"];
const SYSTEM = [
  "You are a security analyst working for the defender. The user runs or protects the system in question and shares its logs, code,",
  "configuration or a suspicious file so you can find what happened: the attack path, when, what was touched or leaked, how bad it is,",
  "and what to fix first. Personal data and secrets were masked before reaching you. Be concrete and prioritised.",
  "Stay on the defensive side: explain how an attack works only as far as needed to detect and stop it; do not write new working",
  "exploits or malware. Answer in the language of the user's question.",
].join(" ");

const MASKS = [
  [/\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g, "[phone masked]"],
  [/\b\d{6}[-\s]?[1-4]\d{6}\b/g, "[id number masked]"],
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[id number masked]"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[card/account masked]"],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email masked]"],
  [/\b(sk-[A-Za-z0-9_-]{12,}|unc_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,}|xox[abprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g, "[secret masked]"],
  [/(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g, "$1 [secret masked] $2"],
];
export function mask(text) {
  let out = text, hits = 0;
  for (const [re, rep] of MASKS) out = out.replace(re, (...a) => { hits++; return rep.replace(/\$(\d)/g, (_, i) => String(a[Number(i)] ?? "")); });
  return { text: out, hits };
}
const REFUSAL = /(도와드릴 수 없|도와드리기 어렵|제공할 수 없|제공해 드릴 수 없|할 수 없습니다|하기 어렵습니다|도움을 드릴 수 없|can'?t (help|assist|provide)|cannot (help|assist|provide|comply)|i'?m (sorry|not able|unable)|against (my|our|the) (policy|guidelines)|i (can not|cannot) )/i;
// The same refusal phrases in every other language as the server (lib/words/refusal.json — this copy is rewritten with it).
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s\\p{P}]+");
const NO_SPACE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}]/u;
const REFUSAL_ANY = new RegExp(`(?:${[...new Set(Object.values(REFUSAL_WORDS).flat().map((p) => p.trim().toLowerCase()).filter(Boolean))].sort((a, b) => b.length - a.length)
  .map((p) => (NO_SPACE.test(p) ? esc(p) : `(?<![\\p{L}\\p{M}\\p{N}])${esc(p)}`)).join("|") || "(?!)"})`, "iu");
export function isRefusal(text) {
  const t = text.trim();
  return !t || ((REFUSAL.test(t.slice(0, 120)) || REFUSAL_ANY.test(t.slice(0, 120))) && t.length < 600);
}

export async function ask(ai, key, prompt, { system = SYSTEM } = {}) {
  const { model, only, maxTokens = 2500 } = CHAIN[ai];
  try {
    const res = await fetch(OPENROUTER_US, {
      method: "POST", signal: AbortSignal.timeout(240_000),
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json", "HTTP-Referer": "https://unchore.ai", "X-Title": "Unchore Defend" },
      body: JSON.stringify({ model, stream: false, max_tokens: maxTokens, usage: { include: true },
        provider: { allow_fallbacks: true, data_collection: "deny", ...(only ? { only } : {}) },
        messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }] }),
    });
    if (!res.ok) {
      const raw = (await res.text().catch(() => "")).slice(0, 300);
      if (res.status === 403 && /flagged_input|moderation|"reasons"/i.test(raw)) return { ai, status: "refused", why: "moderation (403)", cost: 0 };
      return { ai, status: "error", why: `HTTP ${res.status}`, cost: 0 };
    }
    const j = await res.json();
    const choice = j.choices?.[0] ?? {};
    const text = (choice.message?.content ?? "").trim();
    const cost = Number(j.usage?.cost ?? 0) || 0;
    // A provider's content filter blocks before the model writes anything (finish_reason "content_filter", no text).
    if (choice.finish_reason === "content_filter" || choice.native_finish_reason === "content_filter") return { ai, status: "refused", why: "content filter", cost };
    if (!text && choice.finish_reason === "length") return { ai, status: "error", why: "ran out of room before answering", cost };
    return isRefusal(text) ? { ai, status: "refused", why: text ? "refusal" : "empty answer", cost } : { ai, status: "ok", why: "", cost, text };
  } catch (e) {
    return { ai, status: "error", why: String(e?.message ?? e).slice(0, 120), cost: 0 };
  }
}

export async function viaOwnKey(key, question, order) {
  const { text, hits } = mask(question);
  const tried = [];
  let cost = 0;
  for (const ai of order) {
    const r = await ask(ai, key, text);
    cost += r.cost;
    tried.push({ ai: r.ai, status: r.status, why: r.why });
    if (r.status === "ok") return { answer: r.text, answered_by: ai, masked: hits, tried, paid_with: "own_key", cost_usd: cost };
  }
  return { answer: null, answered_by: null, masked: hits, tried, paid_with: "own_key", cost_usd: cost };
}

async function viaUnchore(token, question, material, order) {
  const base = (process.env.UNCHORE_URL || "https://unchore.ai").replace(/\/$/, "");
  // Mask here too, so nothing sensitive leaves your machine even on the way to Unchore.
  const res = await fetch(`${base}/api/defend`, {
    method: "POST", signal: AbortSignal.timeout(300_000),
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ question: mask(question).text, ...(material ? { material: mask(material).text } : {}), chain: order }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) j.message = "UNCHORE_TOKEN was not accepted — make a new key in Unchore → Settings → AI.";
  return j;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const has = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
  const file = flag("--file"), chain = flag("--chain"), json = has("--json"), own = has("--own");
  let question = args.join(" ").trim();
  let material = file ? readFileSync(file, "utf8") : "";
  if (!process.stdin.isTTY) { const piped = readFileSync(0, "utf8"); if (question) material = [material, piped].filter(Boolean).join("\n"); else question = piped; }
  if (!question) { console.error('usage: node scripts/defend.mjs "question" [--file evidence.log] [--chain claude,gpt,glm,deepseek] [--own] [--json]'); process.exit(2); }
  const order = (chain ? chain.split(",").map((x) => x.trim()) : ORDER).filter((x) => CHAIN[x]);
  const token = process.env.UNCHORE_TOKEN, key = process.env.OPENROUTER_API_KEY;
  let r;
  if (token && !own) r = await viaUnchore(token, question, material, order);
  else if (key) r = await viaOwnKey(key, material ? `${question}\n\n--- material ---\n${material}` : question, order);
  else { console.error("Set UNCHORE_TOKEN (Unchore → Settings → AI → New key) or OPENROUTER_API_KEY."); process.exit(2); }
  if (json) { console.log(JSON.stringify(r, null, 1)); process.exit(r.answer ? 0 : 1); }
  if (!r.answer) { console.log(r.message ?? `No answer. Tried: ${(r.tried ?? []).map((t) => `${t.ai}=${t.status}`).join(" · ")}`); process.exit(1); }
  const paid = r.paid_with === "credit" ? `Unchore credit $${Number(r.charged_usd).toFixed(2)} (left $${Number(r.balance_usd).toFixed(2)})` : `your OpenRouter key $${Number(r.cost_usd ?? 0).toFixed(3)}`;
  console.log(`[answered by ${r.answered_by} · ${r.masked} item(s) masked · ${paid}]`);
  for (const t of (r.tried ?? []).slice(0, -1)) console.log(`  - ${t.ai}: ${t.status} (${t.why}) → next`);
  console.log("─".repeat(40));
  console.log(r.answer);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
