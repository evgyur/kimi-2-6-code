import { resolve, sep } from 'path'

type OutputFormat = 'text' | 'json' | 'stream-json'
type PermissionMode = 'acceptEdits' | 'bypassPermissions' | 'default' | 'dontAsk' | 'plan'

export type KimiRunRequest = {
  args: string[]
  cwd?: string
  timeoutMs: number
}

export type KimiRunResult = {
  exitCode: number
  stdout: string
  stderr: string
}

export type GatewayConfig = {
  token?: string
  allowedDirectories: string[]
  command?: string
  defaultTools?: string
  defaultPermissionMode?: PermissionMode
  maxConcurrency?: number
  defaultTimeoutMs?: number
  maxTimeoutMs?: number
  runKimi?: (request: KimiRunRequest) => Promise<KimiRunResult>
}

type ChatRequestBody = {
  prompt?: unknown
  cwd?: unknown
  outputFormat?: unknown
  timeoutMs?: unknown
  addDirs?: unknown
  model?: unknown
  systemPrompt?: unknown
  appendSystemPrompt?: unknown
}

type BuildArgsInput = {
  prompt: string
  tools?: string
  permissionMode?: PermissionMode
  outputFormat?: OutputFormat
  addDirs?: string[]
  model?: string
  systemPrompt?: string
  appendSystemPrompt?: string
}

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_TIMEOUT_MS = 600_000
const DEFAULT_COMMAND = process.env.KIMI_SERVER_COMMAND || 'kimi-code'

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}

function normalizePathForCompare(path: string): string {
  const resolved = resolve(path)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function parseAllowedDirectories(input?: string): string[] {
  if (!input?.trim()) return []
  return input
    .split(/[;\n]/)
    .map(part => part.trim())
    .filter(Boolean)
}

export function isAllowedWorkingDirectory(
  cwd: string | undefined,
  allowedDirectories: string[],
): boolean {
  if (!cwd) return true
  if (allowedDirectories.length === 0) return true

  const normalizedCwd = normalizePathForCompare(cwd)
  return allowedDirectories.some(allowed => {
    const normalizedAllowed = normalizePathForCompare(allowed)
    return (
      normalizedCwd === normalizedAllowed ||
      normalizedCwd.startsWith(`${normalizedAllowed}${sep}`)
    )
  })
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const strings = value.filter(item => typeof item === 'string') as string[]
  return strings.length === value.length ? strings : undefined
}

function asOutputFormat(value: unknown): OutputFormat {
  if (value === 'json' || value === 'stream-json') return value
  return 'text'
}

function asPermissionMode(value: unknown): PermissionMode {
  if (
    value === 'acceptEdits' ||
    value === 'bypassPermissions' ||
    value === 'dontAsk' ||
    value === 'plan'
  ) {
    return value
  }
  return 'default'
}

function clampTimeout(value: unknown, defaultTimeoutMs: number, maxTimeoutMs: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultTimeoutMs
  return Math.max(1_000, Math.min(Math.trunc(value), maxTimeoutMs))
}

export function buildKimiArgs(input: BuildArgsInput): string[] {
  const args = [
    '-p',
    input.prompt,
    '--output-format',
    input.outputFormat ?? 'text',
    '--permission-mode',
    input.permissionMode ?? 'default',
  ]

  if (input.model) {
    args.push('--model', input.model)
  }
  if (input.systemPrompt) {
    args.push('--system-prompt', input.systemPrompt)
  }
  if (input.appendSystemPrompt) {
    args.push('--append-system-prompt', input.appendSystemPrompt)
  }
  for (const dir of input.addDirs ?? []) {
    args.push('--add-dir', dir)
  }

  args.push(`--tools=${input.tools ?? ''}`)
  return args
}

export async function runKimiCode({
  args,
  cwd,
  timeoutMs,
  command = DEFAULT_COMMAND,
}: KimiRunRequest & { command?: string }): Promise<KimiRunResult> {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const timer = setTimeout(() => {
    proc.kill()
  }, timeoutMs)

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { exitCode, stdout, stderr }
  } finally {
    clearTimeout(timer)
  }
}

function isAuthorized(request: Request, token?: string): boolean {
  if (!token) return true
  return request.headers.get('Authorization') === `Bearer ${token}`
}

async function parseJsonBody(request: Request): Promise<ChatRequestBody | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? (body as ChatRequestBody) : null
  } catch {
    return null
  }
}

export function createGatewayApp(config: GatewayConfig): { fetch: (request: Request) => Promise<Response> } {
  const runKimi =
    config.runKimi ??
    ((request: KimiRunRequest) =>
      runKimiCode({ ...request, command: config.command ?? DEFAULT_COMMAND }))
  const defaultTimeoutMs = config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxTimeoutMs = config.maxTimeoutMs ?? MAX_TIMEOUT_MS
  const maxConcurrency = Math.max(1, config.maxConcurrency ?? 1)
  let activeRequests = 0

  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url)

      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true })
      }

      if (request.method !== 'POST' || url.pathname !== '/v1/chat') {
        return json({ ok: false, error: 'not_found' }, { status: 404 })
      }

      if (!isAuthorized(request, config.token)) {
        return json({ ok: false, error: 'unauthorized' }, { status: 401 })
      }

      const body = await parseJsonBody(request)
      if (!body) {
        return json({ ok: false, error: 'invalid_json' }, { status: 400 })
      }
      if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
        return json({ ok: false, error: 'prompt_required' }, { status: 400 })
      }

      const cwd = asOptionalString(body.cwd)
      if (!isAllowedWorkingDirectory(cwd, config.allowedDirectories)) {
        return json({ ok: false, error: 'cwd_not_allowed' }, { status: 403 })
      }

      const addDirs = asStringArray(body.addDirs)
      if (body.addDirs !== undefined && !addDirs) {
        return json({ ok: false, error: 'add_dirs_must_be_strings' }, { status: 400 })
      }
      for (const dir of addDirs ?? []) {
        if (!isAllowedWorkingDirectory(dir, config.allowedDirectories)) {
          return json({ ok: false, error: 'add_dir_not_allowed' }, { status: 403 })
        }
      }
      if (activeRequests >= maxConcurrency) {
        return json({ ok: false, error: 'too_many_requests' }, { status: 429 })
      }

      const timeoutMs = clampTimeout(body.timeoutMs, defaultTimeoutMs, maxTimeoutMs)
      const args = buildKimiArgs({
        prompt: body.prompt,
        tools: config.defaultTools ?? '',
        outputFormat: asOutputFormat(body.outputFormat),
        permissionMode: config.defaultPermissionMode ?? 'default',
        addDirs,
        model: asOptionalString(body.model),
        systemPrompt: asOptionalString(body.systemPrompt),
        appendSystemPrompt: asOptionalString(body.appendSystemPrompt),
      })

      const startedAt = Date.now()
      activeRequests += 1
      let result: KimiRunResult
      let durationMs: number
      try {
        result = await runKimi({ args, cwd, timeoutMs })
        durationMs = Date.now() - startedAt
      } finally {
        activeRequests -= 1
      }

      if (result.exitCode !== 0) {
        return json(
          {
            ok: false,
            error: 'kimi_failed',
            exitCode: result.exitCode,
            stderr: result.stderr,
            durationMs,
          },
          { status: 502 },
        )
      }

      return json({
        ok: true,
        text: result.stdout,
        stderr: result.stderr || undefined,
        durationMs,
      })
    },
  }
}

export function loadGatewayConfigFromEnv(): GatewayConfig & {
  host: string
  port: number
} {
  return {
    host: process.env.KIMI_SERVER_HOST || '127.0.0.1',
    port: Number.parseInt(process.env.KIMI_SERVER_PORT || '8787', 10),
    token: process.env.KIMI_SERVER_TOKEN,
    allowedDirectories: parseAllowedDirectories(process.env.KIMI_ALLOWED_DIRS),
    command: process.env.KIMI_SERVER_COMMAND,
    defaultTools: process.env.KIMI_SERVER_TOOLS || '',
    defaultPermissionMode: asPermissionMode(process.env.KIMI_SERVER_PERMISSION_MODE),
    maxConcurrency: Number.parseInt(
      process.env.KIMI_SERVER_MAX_CONCURRENCY || '1',
      10,
    ),
    defaultTimeoutMs: Number.parseInt(
      process.env.KIMI_SERVER_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS),
      10,
    ),
    maxTimeoutMs: Number.parseInt(
      process.env.KIMI_SERVER_MAX_TIMEOUT_MS || String(MAX_TIMEOUT_MS),
      10,
    ),
  }
}
