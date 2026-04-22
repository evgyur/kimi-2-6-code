# Safety notes for evgyur fork

This fork is hardened for local use with Moonshot Kimi only.

## Changes made

- Locked provider selection to `kimi` in `src/utils/model/providers.ts`
- Disabled remote GrowthBook feature flags in `src/services/analytics/growthbook.ts`
- Removed Anthropic token fallback for Kimi auth in:
  - `src/utils/model/kimi.ts`
  - `src/services/api/client.ts`
- Added `run-safe.sh` launcher that:
  - forces `ANTHROPIC_BASE_URL=https://api.moonshot.ai/anthropic`
  - requires `MOONSHOT_API_KEY`
  - unsets alternate provider/auth environment variables
  - runs with an isolated HOME/XDG state directory

## Residual risk

This is still a coding agent with shell + file access. That means:

- it can read/write files you point it at
- it can run commands you approve or allow
- it can make network requests through commands/tools inside the session

So this fork is safer than upstream, but **not a sandbox substitute**.
Use it with a dedicated user or restricted working directory when possible.
