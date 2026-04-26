import { describe, expect, test } from 'bun:test'
import {
  KIMI_ANTHROPIC_BASE_URL,
  KIMI_CODE_ANTHROPIC_BASE_URL,
  KIMI_CODE_MODEL,
  KIMI_DEFAULT_MODEL,
  getKimiAnthropicBaseUrl,
  isKimiCodeApiKey,
  resolveKimiModelForAPI,
} from './kimi.js'

describe('Kimi auth routing', () => {
  test('detects Kimi Code subscription keys', () => {
    expect(isKimiCodeApiKey('sk-kimi-example')).toBe(true)
    expect(isKimiCodeApiKey(' sk-kimi-example ')).toBe(true)
    expect(isKimiCodeApiKey('sk-moonshot-example')).toBe(false)
    expect(isKimiCodeApiKey(undefined)).toBe(false)
  })

  test('routes Kimi Code keys to the Kimi Code Anthropic endpoint', () => {
    expect(getKimiAnthropicBaseUrl('sk-kimi-example')).toBe(
      KIMI_CODE_ANTHROPIC_BASE_URL,
    )
    expect(getKimiAnthropicBaseUrl('sk-moonshot-example')).toBe(
      KIMI_ANTHROPIC_BASE_URL,
    )
  })

  test('uses the Kimi Code stable model id for Kimi Code keys', () => {
    expect(resolveKimiModelForAPI(KIMI_DEFAULT_MODEL, 'sk-kimi-example')).toBe(
      KIMI_CODE_MODEL,
    )
    expect(resolveKimiModelForAPI(KIMI_DEFAULT_MODEL, 'sk-moonshot-example')).toBe(
      KIMI_DEFAULT_MODEL,
    )
  })
})
