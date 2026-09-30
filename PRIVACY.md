# Privacy — Unchore Defend plugin

Last updated: 2026-10-01

This covers the Unchore Defend plugin (the `site-check` and `unchore-defend` skills and the `unchore-defend` MCP server).
For the Unchore service itself (unchore.ai), see https://unchore.ai/privacy.

## Site check

- Sends one ordinary web request (GET) to the site you ask it to check, and reads the response headers.
- Sends nothing to Unchore or anyone else. Nothing is stored.

## Defend

- Reads the question and the evidence you give it (log lines, code, a message). These can contain personal data.
- Before anything leaves your machine, it masks phone numbers, ID/card/account numbers, e-mail addresses, API keys, tokens and private keys. IP addresses, paths and timestamps are kept because they are the evidence.
- The masked text goes to one place, depending on the key you set:
  - **Your OpenRouter key:** straight from your machine to OpenRouter, asking it to route only to providers that don't collect data (`data_collection: deny`). OpenRouter's own policy applies: https://openrouter.ai/privacy
  - **Your Unchore key:** to unchore.ai, which passes it to OpenRouter the same way. Unchore does not store the question, the evidence or the answer. It keeps one billing line per check: the cost and which AI answered.
- The plugin itself stores nothing. Keys you enter in Claude Code are kept in your system's secure storage.

## Contact

support@unchore.ai
