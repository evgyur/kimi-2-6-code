import { isEnvTruthy } from '../envUtils.js'

export const KIMI_DEFAULT_MODEL = 'kimi-k2.6'
export const KIMI_ANTHROPIC_BASE_URL = 'https://api.moonshot.ai/anthropic'
export const KIMI_CODE_MODEL = 'kimi-for-coding'
export const KIMI_CODE_ANTHROPIC_BASE_URL = 'https://api.kimi.com/coding/'

export function isKimiCodeApiKey(apiKey?: string | null): boolean {
  return apiKey?.trim().startsWith('sk-kimi-') ?? false
}

export function getKimiApiKey(): string | undefined {
  // Kimi Code docs use KIMI_API_KEY. Keep MOONSHOT_API_KEY for the original
  // Moonshot Open Platform flow and backwards compatibility with this fork.
  return process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY
}

export function getKimiAnthropicBaseUrl(apiKey?: string | null): string {
  return isKimiCodeApiKey(apiKey ?? getKimiApiKey())
    ? KIMI_CODE_ANTHROPIC_BASE_URL
    : KIMI_ANTHROPIC_BASE_URL
}

export function resolveKimiModelForAPI(
  model: string,
  apiKey?: string | null,
): string {
  return isKimiCodeApiKey(apiKey ?? getKimiApiKey()) ? KIMI_CODE_MODEL : model
}

export function isKimiAnthropicBaseUrl(baseUrl?: string): boolean {
  if (!baseUrl) return false
  try {
    const url = new URL(baseUrl)
    return (
      url.hostname === 'api.moonshot.ai' &&
      (url.pathname === '/anthropic' ||
        url.pathname.startsWith('/anthropic/'))
    )
  } catch {
    return false
  }
}

export function isKimiProviderEnabled(): boolean {
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_KIMI)) return false
  return true
}

export function getMoonshotApiKey(): string | undefined {
  // Safety-hardened fork: only accept the explicit Moonshot key.
  // Do not silently reuse Anthropic auth tokens for Kimi requests.
  return getKimiApiKey()
}
