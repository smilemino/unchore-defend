---
name: unchore-defend
description: Security analysis for defenders — reads a log, code, config or suspicious message and says what happened, how bad it is and what to fix first. Masks personal data and secrets before sending; if one AI refuses, the next one answers (Claude → GPT → GLM → DeepSeek).
---

# Unchore Defend

For the person **protecting** a system: "we were hit — what happened?", "is this log an attack?", "what did this script do?".
Some AI safety filters refuse even the defender. Defend asks Claude first and, only if it refuses, moves on to GPT, then
GLM and DeepSeek (served from US hosts that don't train on your data).

## How to use

1. Put the question in plain words. Put the evidence (log lines, code, the message) in a file.
2. Run from this skill's folder (Node 22+, no install):
   `node scripts/defend.mjs "Who got in, and what did they take?" --file /path/to/access.log`
   (or pipe the evidence: `tail -n 500 access.log | node scripts/defend.mjs "Is this an attack?"`)
3. Show the user the answer **and** the first line (which AI answered, how many items were masked, what it cost).

## Paying for the AI — pick one

- **Unchore credit (no AI account needed):** sign in at https://unchore.ai → Settings → AI → Unchore credit → *New key*,
  then `export UNCHORE_TOKEN=unc_…`. Each check takes what the AI cost plus a small margin.
- **Your own OpenRouter key:** `export OPENROUTER_API_KEY=sk-or-…` — runs straight from your machine, Unchore isn't involved.

If both are set, Unchore credit is used. `--own` forces your OpenRouter key.

## Rules

- Defensive use only: finding what happened and how to stop it. Don't ask it to write new exploits or malware.
- Phone numbers, ID/card/account numbers, e-mails, API keys, tokens and private keys are masked **before** anything is sent.
  IP addresses, paths and timestamps are kept — they are the evidence.
- `--chain glm,deepseek` sets the order yourself. `--json` prints machine-readable output.
