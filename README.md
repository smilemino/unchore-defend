# Unchore Defend

**Security help for the person protecting the system.** Two tools, no install, works in Claude Code, Claude Desktop, any MCP client, or a plain terminal.

[English](README.md) · [한국어](README.ko.md)

![Unchore Defend in 20 seconds](docs/demo.gif)

> **July 2026:** an AI agent broke out of its test sandbox and got into Hugging Face's production systems. Hugging Face counted about 17,600 attacker actions across 11 nodes over roughly 4.5 days. When the responders asked commercial frontier models to help read the logs, the requests were *"blocked by the providers' safety guardrails, which cannot distinguish an incident responder from an attacker."* They finished the forensics on an open-weight model (GLM-5.2).
> Sources: [disclosure](https://huggingface.co/blog/security-incident-july-2026) · [technical timeline](https://huggingface.co/blog/agent-intrusion-technical-timeline)
>
> **Defend makes that switch for you:** it asks Claude, then GPT, then GLM, then DeepSeek, and moves on only when one refuses.

| Tool | What you get | Needs |
|---|---|---|
| **site check** | Your site's security headers graded A–F, the one-line fix for each gap, and a README badge | Nothing — no account, no key |
| **defend** | Paste a log, code, config or a suspicious message → what happened, how bad it is, what to fix first | An OpenRouter key *or* an Unchore key |

```
$ node skills/site-check/scripts/site-check.mjs example.com
https://example.com/ → F (37/100) · HTTP 200

✓ Served over HTTPS
✗ HSTS (browsers stay on HTTPS) (−15) — fix: Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
✗ Content-Security-Policy set (−15) — fix: Add a Content-Security-Policy; start with `default-src 'self'` …
…
```

## Install

**Claude Code** (skills + MCP tools):

```
/plugin marketplace add smilemino/unchore-defend
/plugin install unchore-defend@unchore
```

Then just ask: *"check the security headers of mysite.com and fix what you can"* or *"read access.log — were we attacked?"*

Only want the site check? `/plugin install unchore-site-check@unchore` installs just that (no key, no AI calls).

The site check needs no key. For defend, Claude Code asks for an OpenRouter or Unchore key when you enable the plugin (later: `/plugin configure unchore-defend@unchore`); it is kept in your system's secure storage.

**Claude Desktop:** download `unchore-defend.mcpb` from [Releases](https://github.com/smilemino/unchore-defend/releases) and open it.

**Any MCP client** (Cursor, VS Code, Windsurf, …) — clone this repo, then add:

```json
{
  "mcpServers": {
    "unchore-defend": {
      "command": "node",
      "args": ["/path/to/unchore-defend/mcp/server.mjs"],
      "env": { "OPENROUTER_API_KEY": "sk-or-…" }
    }
  }
}
```

**Terminal only:** Node 22+, nothing to install.

```
node skills/site-check/scripts/site-check.mjs mysite.com
node skills/unchore-defend/scripts/defend.mjs "Who got in, and what did they take?" --file access.log
tail -n 500 access.log | node skills/unchore-defend/scripts/defend.mjs "Is this an attack?"
```

## Site check

Nine checks, weighted: HTTPS (25), HSTS (15), Content-Security-Policy (15), clickjacking protection (10), `nosniff` (10), Referrer-Policy (8), Permissions-Policy (5), cookie flags (7), server version hidden (5). A ≥ 90 · B ≥ 75 · C ≥ 60 · D ≥ 40.

It sends one ordinary GET to the site and nothing anywhere else. Private, local and cloud-metadata addresses are refused, every redirect is checked again, and it stops after 3 redirects, 8 seconds or 200 KB.

Put the grade in your README — the output gives you the line:

[![Security headers: B (80/100) — checked with Unchore](https://img.shields.io/badge/security%20headers-B%20(80%2F100)-green)](https://unchore.ai/tools/site-check?utm_source=badge&utm_campaign=site-check)

The badge says what was measured: response headers. It is not a full security audit.

Rather click than type? The same check runs at [unchore.ai/tools/site-check](https://unchore.ai/tools/site-check?utm_source=github&utm_campaign=defend-readme).

## Defend

For "we were hit — what happened?", "is this log an attack?", "what did this script do?".

- **Masked before sending:** phone numbers, ID/card/account numbers, e-mails, API keys, tokens and private keys. IP addresses, paths and timestamps stay — they are the evidence.
- **If one AI refuses, the next answers.** Some safety filters refuse even defenders. Defend asks Claude first, then GPT, GLM and DeepSeek — only when the one before refused. GLM and DeepSeek run on US hosts, and every request asks OpenRouter to route only to providers that don't collect data (`data_collection: deny`).
- **Defensive use only.** It explains an attack as far as needed to detect and stop it. The AIs are told not to write exploits or malware.

Pay for the AI one of two ways:

- `OPENROUTER_API_KEY` — your own key; requests go straight from your machine to OpenRouter.
- `UNCHORE_TOKEN` — no AI account needed. Sign in at [unchore.ai](https://unchore.ai/?utm_source=github&utm_campaign=defend-readme) → Settings → AI → Unchore credit → *New key*.

`--chain glm,deepseek` sets the order, `--own` forces your OpenRouter key, `--json` prints machine-readable output.

### Tested on real traffic

640 lines of our own production web logs (7 days, IP addresses removed): 69 real attack lines (WordPress admin probes, `.git`/`.env` fishing, scanner bots) and 571 normal lines.

| AI | Attacks caught | False alarms | Refusals |
|---|---|---|---|
| Claude | 69 / 69 | 0 | 0 |
| GPT | 69 / 69 | 0 | 0 |
| DeepSeek | 69 / 69 | 10 | 0 |
| GLM | 69 / 69 | 14 | 0 |

No AI refused plain log triage. Claude and GPT were the most precise, so they go first. Refusals show up on harder work, like the payload analysis where Hugging Face got blocked. That is where the fallback helps.

## Why this exists

[Unchore](https://unchore.ai/?utm_source=github&utm_campaign=defend-readme) is a personal AI that notices when you ask for the same thing twice and offers to do it for you from then on. These two tools are pieces of it that also work on their own.

## Contributing

Issues and pull requests are welcome. Run `node --test test/*.test.mjs` before sending. Security problems: see [SECURITY.md](SECURITY.md). What is sent where: [PRIVACY.md](PRIVACY.md).

MIT © 2026 Unchore
