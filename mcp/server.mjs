#!/usr/bin/env node
// Unchore Defend as an MCP server (stdio, newline-delimited JSON-RPC). No install: Node 22+ only.
// Tools: site_check (security headers → grade, fixes, badge) and defend_analyze (a log/code/message → what happened, what to fix).
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkSite, report, badge } from "../skills/site-check/scripts/site-check.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFEND = join(ROOT, "skills/unchore-defend/scripts/defend.mjs");
export const VERSION = "0.1.0";

export const TOOLS = [
  {
    name: "site_check",
    title: "Website security headers check",
    description: "Grade a public website's security headers and cookie flags (A–F, 0–100) with the one-line fix for each gap and a README badge. Sends one GET to the site only.",
    inputSchema: { type: "object", properties: { url: { type: "string", description: "Site address, e.g. example.com" } }, required: ["url"] },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "defend_analyze",
    title: "Security analysis for defenders",
    description: "Read a log, code, config or suspicious message and say what happened, how bad it is and what to fix first. Personal data and secrets are masked before sending. If one AI refuses, the next answers (Claude → GPT → GLM → DeepSeek). Needs UNCHORE_TOKEN or OPENROUTER_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question in plain words, e.g. 'Who got in and what did they take?'" },
        evidence: { type: "string", description: "Log lines, code or the message to analyse (optional)" },
        chain: { type: "string", description: "Order of AIs, e.g. 'claude,gpt,glm,deepseek' (optional)" },
      },
      required: ["question"],
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];

const text = (t, isError = false) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });

function runDefend({ question, evidence = "", chain }) {
  return new Promise((ok) => {
    const args = [DEFEND, question, "--json", ...(chain ? ["--chain", chain] : [])];
    const p = spawn(process.execPath, args, { env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (c) => { out += c; });
    p.stderr.on("data", (c) => { err += c; });
    p.on("close", () => {
      let r;
      try { r = JSON.parse(out); } catch { return ok(text((err || out || "Defend did not answer.").trim(), true)); }
      if (!r.answer) return ok(text(r.message ?? `No answer. Tried: ${(r.tried ?? []).map((t) => `${t.ai}=${t.status}`).join(" · ")}`, true));
      const paid = r.paid_with === "credit" ? `Unchore credit $${Number(r.charged_usd).toFixed(2)}` : `own OpenRouter key $${Number(r.cost_usd ?? 0).toFixed(3)}`;
      ok(text(`[answered by ${r.answered_by} · ${r.masked} item(s) masked · ${paid}]\n\n${r.answer}`));
    });
    p.stdin.end(evidence);
  });
}

export async function callTool(name, a = {}) {
  if (name === "site_check") {
    const r = await checkSite(String(a.url ?? ""));
    if ("error" in r) return text(r.error === "bad_address" ? "That address can't be checked (only public http/https sites on ports 80/443)." : "The site didn't answer within 8 seconds.", true);
    return { ...text(report(r)), structuredContent: { ...r, badge: badge(r) } };
  }
  if (name === "defend_analyze") {
    if (!String(a.question ?? "").trim()) return text("question is required", true);
    return runDefend({ question: String(a.question), evidence: String(a.evidence ?? ""), chain: a.chain ? String(a.chain) : undefined });
  }
  return null;
}

export async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return null; // notifications need no answer
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "unchore-defend", title: "Unchore Defend", version: VERSION },
        instructions: "site_check grades a website's security headers; defend_analyze reads logs, code or a suspicious message for the defender.",
      });
    case "ping": return reply({});
    case "tools/list": return reply({ tools: TOOLS });
    case "tools/call": {
      const r = await callTool(params?.name, params?.arguments);
      return r ? reply(r) : fail(-32602, `Unknown tool: ${params?.name}`);
    }
    default: return fail(-32601, `Method not found: ${method}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return void process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n"); }
    const out = await handle(msg).catch((e) => ({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String(e?.message ?? e) } }));
    if (out) process.stdout.write(JSON.stringify(out) + "\n");
  });
}
