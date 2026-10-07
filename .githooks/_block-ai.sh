#!/bin/sh
# Bloquea operaciones de git cuando las ejecuta un agente de IA.
# Se detecta por las variables de entorno que los agentes inyectan en sus shells.
# Uso: . "$(dirname "$0")/_block-ai.sh" "<operación>"

op="$1"

for var in CLAUDECODE CLAUDE_CODE_ENTRYPOINT AI_AGENT CURSOR_AGENT CODEX_SANDBOX CODEX_SANDBOX_NETWORK_DISABLED GEMINI_CLI COPILOT_AGENT AIDER_CHAT; do
  eval "val=\${$var:-}"
  if [ -n "$val" ]; then
    echo "✖ Bloqueado: los agentes de IA no pueden hacer '$op' en este repo (detectado $var)." >&2
    echo "  Haz el $op tú mismo desde tu propia terminal." >&2
    exit 1
  fi
done
