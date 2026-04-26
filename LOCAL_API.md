# Kimi Code Local API

This repository includes a small local HTTP gateway over `kimi-code -p` for bots,
automation tools, and trusted devices.

## Start

```powershell
$env:KIMI_SERVER_TOKEN = "change-me"
$env:KIMI_ALLOWED_DIRS = "C:\Users\user\kimi-2-6-code"
bun run server
```

By default the server listens on `127.0.0.1:8787`.

For LAN access, bind explicitly and use a real token:

```powershell
$env:KIMI_SERVER_HOST = "0.0.0.0"
$env:KIMI_SERVER_PORT = "8787"
$env:KIMI_SERVER_TOKEN = "long-random-token"
bun run server
```

Prefer Tailscale or WireGuard for access from other devices. Do not expose this
server directly to the public internet.

## Request

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://127.0.0.1:8787/v1/chat" `
  -Headers @{ Authorization = "Bearer change-me" } `
  -ContentType "application/json" `
  -Body (@{
    prompt = "Summarize this repository"
    cwd = "C:\Users\user\kimi-2-6-code"
    tools = ""
  } | ConvertTo-Json)
```

## Endpoints

- `GET /health`
- `POST /v1/chat`

`POST /v1/chat` accepts:

- `prompt` string, required
- `cwd` string, optional and checked against `KIMI_ALLOWED_DIRS`
- `tools` is controlled by `KIMI_SERVER_TOOLS`, not by clients
- `permissionMode` is controlled by `KIMI_SERVER_PERMISSION_MODE`, not by clients
- `outputFormat` string, optional; `text`, `json`, or `stream-json`
- `timeoutMs` number, optional
- `addDirs` string array, optional
- `model`, `systemPrompt`, and `appendSystemPrompt` are controlled by server env only

## Environment

- `KIMI_SERVER_HOST`, default `127.0.0.1`
- `KIMI_SERVER_PORT`, default `8787`
- `KIMI_SERVER_TOKEN`, bearer token; strongly recommended
- `KIMI_ALLOWED_DIRS`, semicolon-separated allowed working directories
- `KIMI_SERVER_COMMAND`, default `kimi-code`
- `KIMI_SERVER_TOOLS`, default disabled tools
- `KIMI_SERVER_PERMISSION_MODE`, default `default`
- `KIMI_SERVER_MODEL`, optional server-side model override
- `KIMI_SERVER_SYSTEM_PROMPT`, optional server-side system prompt
- `KIMI_SERVER_APPEND_SYSTEM_PROMPT`, optional server-side appended system prompt
- `KIMI_SERVER_INCLUDE_STDERR`, set `1` only for trusted debugging
- `KIMI_SERVER_TIMEOUT_MS`, default `120000`
- `KIMI_SERVER_MAX_TIMEOUT_MS`, default `600000`
