import { describe, expect, test } from 'bun:test'
import { join } from 'path'
import {
  buildKimiArgs,
  createGatewayApp,
  isAllowedWorkingDirectory,
  parseAllowedDirectories,
} from './gateway.js'

describe('gateway configuration', () => {
  test('parses allowed directories from a path-list string', () => {
    const dirs = parseAllowedDirectories(`C:\\work; C:\\other ;;`)

    expect(dirs).toEqual(['C:\\work', 'C:\\other'])
  })

  test('allows child paths inside configured directories', () => {
    const repo = join('tmp', 'repo')
    const allowed = [repo]

    expect(isAllowedWorkingDirectory(repo, allowed)).toBe(true)
    expect(isAllowedWorkingDirectory(join(repo, 'subdir'), allowed)).toBe(true)
    expect(isAllowedWorkingDirectory(join('tmp', 'other'), allowed)).toBe(false)
  })

  test('builds a conservative kimi-code print invocation', () => {
    expect(
      buildKimiArgs({
        prompt: 'say hi',
        tools: '',
        permissionMode: 'default',
        outputFormat: 'text',
      }),
    ).toEqual([
      '-p',
      'say hi',
      '--output-format',
      'text',
      '--permission-mode',
      'default',
      '--tools=',
    ])
  })
})

describe('gateway HTTP app', () => {
  test('serves health without auth', async () => {
    const app = createGatewayApp({
      token: 'secret',
      allowedDirectories: [],
      runKimi: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    })

    const response = await app.fetch(new Request('http://localhost/health'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
  })

  test('rejects chat requests without bearer token', async () => {
    const app = createGatewayApp({
      token: 'secret',
      allowedDirectories: [],
      runKimi: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    })

    const response = await app.fetch(
      new Request('http://localhost/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'hello' }),
      }),
    )

    expect(response.status).toBe(401)
  })

  test('runs kimi-code and returns stdout', async () => {
    const app = createGatewayApp({
      token: 'secret',
      allowedDirectories: ['C:\\Users\\user\\repo'],
      defaultTools: '',
      defaultPermissionMode: 'default',
      runKimi: async ({ args, cwd }) => ({
        exitCode: 0,
        stdout: `cwd=${cwd}; args=${args.join(' ')}`,
        stderr: '',
      }),
    })

    const response = await app.fetch(
      new Request('http://localhost/v1/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'hello',
          cwd: 'C:\\Users\\user\\repo',
          tools: 'Bash',
          permissionMode: 'bypassPermissions',
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.text).toContain('cwd=C:\\Users\\user\\repo')
    expect(body.text).toContain('-p hello')
    expect(body.text).toContain('--permission-mode default')
    expect(body.text).toContain('--tools=')
    expect(body.text).not.toContain('bypassPermissions')
    expect(body.text).not.toContain('Bash')
  })

  test('rejects cwd outside allowlist', async () => {
    const app = createGatewayApp({
      token: 'secret',
      allowedDirectories: ['C:\\Users\\user\\repo'],
      runKimi: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    })

    const response = await app.fetch(
      new Request('http://localhost/v1/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'hello',
          cwd: 'C:\\Users\\user\\other',
        }),
      }),
    )

    expect(response.status).toBe(403)
  })

  test('rejects addDirs outside allowlist', async () => {
    const app = createGatewayApp({
      token: 'secret',
      allowedDirectories: ['C:\\Users\\user\\repo'],
      runKimi: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    })

    const response = await app.fetch(
      new Request('http://localhost/v1/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'hello',
          cwd: 'C:\\Users\\user\\repo',
          addDirs: ['C:\\Users\\user\\other'],
        }),
      }),
    )

    expect(response.status).toBe(403)
  })

  test('limits concurrent kimi-code runs', async () => {
    let release!: () => void
    const blocker = new Promise<void>(resolve => {
      release = resolve
    })
    const app = createGatewayApp({
      token: 'secret',
      allowedDirectories: [],
      maxConcurrency: 1,
      runKimi: async () => {
        await blocker
        return { exitCode: 0, stdout: 'ok', stderr: '' }
      },
    })

    const first = app.fetch(
      new Request('http://localhost/v1/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'first' }),
      }),
    )
    const second = await app.fetch(
      new Request('http://localhost/v1/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'second' }),
      }),
    )

    release()
    await first
    expect(second.status).toBe(429)
  })
})
