# Intel64 Kimi Code API Deployment

Production-like gateway is deployed on `intel64`.

## Endpoint

```text
https://clawport.evgyur.vip/kimi-code-api
```

Health:

```text
GET https://clawport.evgyur.vip/kimi-code-api/health
```

Chat:

```text
POST https://clawport.evgyur.vip/kimi-code-api/v1/chat
Authorization: Bearer <token>
Content-Type: application/json
```

The bearer token is stored on `intel64`:

```bash
sudo grep '^KIMI_SERVER_TOKEN=' /etc/kimi-code-api.env
```

Do not commit or paste that token into public logs.

## Service

```bash
sudo systemctl status kimi-code-api.service
sudo systemctl restart kimi-code-api.service
sudo journalctl -u kimi-code-api.service -f
```

Files:

- Source: `/home/chip/kimi-2-6-code`
- Env file: `/etc/kimi-code-api.env`
- Systemd unit: `/etc/systemd/system/kimi-code-api.service`
- Nginx route: `/etc/nginx/sites-available/clawport.evgyur.vip`

Backend bind is `127.0.0.1:8787`; public access goes through nginx on HTTPS.

## Example: curl

```bash
TOKEN='<token>'

curl -fsS https://clawport.evgyur.vip/kimi-code-api/health

curl -fsS \
  -X POST https://clawport.evgyur.vip/kimi-code-api/v1/chat \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "prompt": "Reply with exactly OK.",
    "cwd": "/home/chip/kimi-2-6-code",
    "tools": ""
  }'
```

## Example: TypeScript bot

```ts
const response = await fetch(
  'https://clawport.evgyur.vip/kimi-code-api/v1/chat',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KIMI_CODE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: 'Summarize the current task.',
      cwd: '/home/chip/kimi-2-6-code',
      tools: '',
    }),
  },
)

const result = await response.json()
console.log(result.text)
```

## Example: Codex usage

For another Codex session or helper script, set:

```bash
export KIMI_CODE_API_URL='https://clawport.evgyur.vip/kimi-code-api'
export KIMI_CODE_API_TOKEN='<token>'
```

Then call:

```bash
curl -fsS \
  -X POST "${KIMI_CODE_API_URL}/v1/chat" \
  -H "Authorization: Bearer ${KIMI_CODE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"prompt":"Review this patch conceptually.","tools":""}'
```

## Request fields

- `prompt` string, required
- `cwd` string, optional; must be under `KIMI_ALLOWED_DIRS`
- `tools` is controlled by `KIMI_SERVER_TOOLS`, not by clients
- `permissionMode` is controlled by `KIMI_SERVER_PERMISSION_MODE`, not by clients
- `outputFormat` string, optional; `text`, `json`, or `stream-json`
- `timeoutMs` number, optional
- `addDirs` string array, optional
- `model`, `systemPrompt`, and `appendSystemPrompt` are controlled by server env only
