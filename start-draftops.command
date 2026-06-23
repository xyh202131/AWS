#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

host="127.0.0.1"
agent_pid=""
vite_pid=""

print_info() {
  printf "\033[36m%s\033[0m\n" "$1"
}

print_warn() {
  printf "\033[33m%s\033[0m\n" "$1"
}

print_error() {
  printf "\033[31m%s\033[0m\n" "$1"
}

cleanup() {
  if [[ -n "$vite_pid" ]] && kill -0 "$vite_pid" 2>/dev/null; then
    kill "$vite_pid" 2>/dev/null || true
  fi

  if [[ -n "$agent_pid" ]] && kill -0 "$agent_pid" 2>/dev/null; then
    kill "$agent_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

is_valid_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && (( "$1" > 0 && "$1" < 65536 ))
}

preferred_port() {
  local env_name="$1"
  local default_port="$2"
  local value="${!env_name:-}"

  if is_valid_port "$value"; then
    printf "%s\n" "$value"
  else
    printf "%s\n" "$default_port"
  fi
}

port_available() {
  local port="$1"
  ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

available_port_from() {
  local start_port="$1"
  local attempts="${2:-40}"
  local port

  for ((port = start_port; port < start_port + attempts; port++)); do
    if port_available "$port"; then
      printf "%s\n" "$port"
      return 0
    fi
  done

  return 1
}

agent_healthy() {
  local port="$1"
  local origin="$2"
  curl -fsS -H "Origin: $origin" "http://$host:$port/api/deepseek/health" >/dev/null 2>&1
}

wait_for_http() {
  local url="$1"
  local timeout_seconds="${2:-30}"
  local deadline=$((SECONDS + timeout_seconds))
  local status

  while (( SECONDS < deadline )); do
    status="$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)"
    if [[ "$status" =~ ^[234][0-9][0-9]$ ]]; then
      return 0
    fi
    sleep 0.5
  done

  return 1
}

print_info "DraftOps macOS launcher"
printf "Project: %s\n\n" "$(pwd)"

if ! command -v node >/dev/null 2>&1; then
  print_error "Node.js was not found. Install Node.js 22+ first, then run this launcher again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  print_error "npm was not found. Reinstall Node.js with npm enabled."
  exit 1
fi

if [[ ! -d "node_modules" ]]; then
  print_warn "Installing dependencies..."
  npm install
fi

preferred_client_port="$(preferred_port DRAFTOPS_CLIENT_PORT 3002)"
client_port="$(available_port_from "$preferred_client_port")"
client_origin="http://$host:$client_port"
url="$client_origin/"

if [[ "$client_port" != "$preferred_client_port" ]]; then
  print_warn "Port $preferred_client_port is occupied; using DraftOps frontend port $client_port."
fi

preferred_agent_port="$(preferred_port DEEPSEEK_AGENT_PORT 4318)"
agent_port="$preferred_agent_port"

if agent_healthy "$agent_port" "$client_origin"; then
  print_info "Using existing DeepSeek local proxy on http://$host:$agent_port"
else
  if ! port_available "$agent_port"; then
    agent_port="$(available_port_from "$((preferred_agent_port + 1))")"
    print_warn "Port $preferred_agent_port is occupied by another process; using DeepSeek proxy port $agent_port."
  fi

  print_warn "Starting DeepSeek local proxy on http://$host:$agent_port"
  DEEPSEEK_AGENT_PORT="$agent_port" \
    DRAFTOPS_CLIENT_ORIGIN="$client_origin" \
    node scripts/deepseek-chat-server.mjs &
  agent_pid="$!"

  agent_ready=false
  for _ in {1..20}; do
    if agent_healthy "$agent_port" "$client_origin"; then
      agent_ready=true
      break
    fi
    sleep 0.5
  done

  if [[ "$agent_ready" != "true" ]]; then
    print_warn "DeepSeek proxy did not answer yet; the page can still load, but chat may need a refresh."
  fi
fi

export VITE_DEEPSEEK_AGENT_PORT="$agent_port"

printf "\n"
print_warn "Starting DraftOps dev server on $url"
print_warn "Keep this Terminal window open while using DraftOps."
printf "\n"

npm run dev -- --host "$host" --port "$client_port" --strictPort &
vite_pid="$!"

if wait_for_http "$url" 30; then
  print_info "Opening $url"
  open "$url"
else
  print_error "DraftOps did not answer within 30 seconds. If Vite printed an error above, fix it and rerun this launcher."
fi

wait "$vite_pid"
