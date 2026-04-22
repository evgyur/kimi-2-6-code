#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SAFE_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/kimi-2-6-code-safe"
mkdir -p "$SAFE_HOME"
mkdir -p "$SAFE_HOME/home"
mkdir -p "$SAFE_HOME/state"
mkdir -p "$SAFE_HOME/cache"
chmod 700 "$SAFE_HOME" "$SAFE_HOME/home" "$SAFE_HOME/state" "$SAFE_HOME/cache"

export HOME="$SAFE_HOME/home"
export XDG_STATE_HOME="$SAFE_HOME/state"
export XDG_CACHE_HOME="$SAFE_HOME/cache"
export ANTHROPIC_BASE_URL="https://api.moonshot.ai/anthropic"
export CLAUDE_CODE_DISABLE_KIMI=0

# Hard-disable alternate provider selection and inherited auth fallbacks.
unset CLAUDE_CODE_USE_BEDROCK
unset CLAUDE_CODE_USE_VERTEX
unset CLAUDE_CODE_USE_FOUNDRY
unset CLAUDE_CODE_USE_OPENAI
unset ANTHROPIC_API_KEY
unset ANTHROPIC_AUTH_TOKEN
unset CLAUDE_CODE_OAUTH_TOKEN
unset CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR
unset CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR
unset AWS_PROFILE AWS_REGION AWS_DEFAULT_REGION
unset GOOGLE_APPLICATION_CREDENTIALS CLOUD_ML_REGION
unset ANTHROPIC_VERTEX_PROJECT_ID ANTHROPIC_FOUNDRY_API_KEY ANTHROPIC_FOUNDRY_RESOURCE ANTHROPIC_FOUNDRY_BASE_URL

if [[ -z "${MOONSHOT_API_KEY:-}" ]]; then
  echo "MOONSHOT_API_KEY is required." >&2
  exit 1
fi

exec "$SCRIPT_DIR/cli" "$@"
