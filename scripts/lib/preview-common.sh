#!/usr/bin/env bash

PREVIEW_HOST_SUFFIX="fabrique.infinitynode.ai"
PREVIEW_PORT_MIN="${FABRIQUE_PREVIEW_PORT_MIN:-5300}"
PREVIEW_PORT_MAX="${FABRIQUE_PREVIEW_PORT_MAX:-5399}"

preview_registry_path() {
  printf '%s\n' "${FABRIQUE_PREVIEW_REGISTRY:-${HOME}/.local/state/fabrique/previews.json}"
}

preview_systemd_dir() {
  printf '%s\n' "${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
}

preview_require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    printf 'error: jq is required for Fabrique preview registry updates\n' >&2
    exit 1
  fi
}

preview_validate_slug() {
  local slug="${1:-}"
  if [[ ! "${slug}" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
    printf 'error: invalid slug %q; use lowercase DNS-label characters only (a-z, 0-9, hyphen; no leading/trailing hyphen)\n' "${slug}" >&2
    exit 2
  fi
  if (( ${#slug} > 54 )); then
    printf 'error: invalid slug %q; maximum length is 54 characters so %q remains a valid DNS label\n' "${slug}" "${slug}-fabrique" >&2
    exit 2
  fi
}

preview_validate_systemd_path() {
  local path="$1"
  if [[ "${path}" == *[$'\001'-$'\037'$'\177']* ]]; then
    printf 'error: path contains control characters and cannot be safely written to a systemd unit: %q\n' "${path}" >&2
    exit 1
  fi
}

preview_hostname() {
  local slug="$1"
  printf '%s-%s\n' "${slug}" "${PREVIEW_HOST_SUFFIX}"
}

preview_service_name() {
  local slug="$1"
  printf 'fabrique-preview-%s\n' "${slug}"
}

preview_unit_path() {
  local slug="$1"
  printf '%s/%s.service\n' "$(preview_systemd_dir)" "$(preview_service_name "${slug}")"
}

preview_ensure_registry() {
  local registry="$1"
  mkdir -p "$(dirname "${registry}")"
  if [[ ! -e "${registry}" ]]; then
    printf '{}\n' >"${registry}"
  fi
}

preview_read_registry() {
  local registry="$1"
  if [[ -f "${registry}" ]]; then
    cat "${registry}"
  else
    printf '{}\n'
  fi
}

preview_now() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

preview_branch_for_worktree() {
  local worktree="$1"
  git -C "${worktree}" branch --show-current 2>/dev/null || printf 'unknown\n'
}

preview_port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :${port}" | tail -n +2 | grep -q .
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN -Pn >/dev/null 2>&1
    return $?
  fi
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "${port}" >/dev/null 2>&1
    return $?
  fi
  return 1
}

preview_pick_port() {
  local registry="$1"
  local slug="$2"
  local existing
  existing="$(preview_read_registry "${registry}" | jq -r --arg slug "${slug}" '.[$slug].port // empty')"
  if [[ -n "${existing}" ]]; then
    printf '%s\n' "${existing}"
    return 0
  fi

  local used port
  used="$(preview_read_registry "${registry}" | jq -r '.[].port // empty')"
  for ((port = PREVIEW_PORT_MIN; port <= PREVIEW_PORT_MAX; port++)); do
    if grep -qx "${port}" <<<"${used}"; then
      continue
    fi
    if preview_port_in_use "${port}"; then
      continue
    fi
    printf '%s\n' "${port}"
    return 0
  done

  printf 'error: no free preview port in range %s-%s\n' "${PREVIEW_PORT_MIN}" "${PREVIEW_PORT_MAX}" >&2
  exit 1
}

preview_systemctl() {
  systemctl --user "$@"
}

preview_have_systemd_user() {
  command -v systemctl >/dev/null 2>&1 && preview_systemctl show-environment >/dev/null 2>&1
}

preview_print_route_snippets() {
  local slug="$1"
  local port="$2"
  local hostname
  hostname="$(preview_hostname "${slug}")"
  cat <<EOF

Host routing still needs the host-local Traefik/cloudflared step. Add an idempotent router/service equivalent to:

traefik dynamic.yml:
  http:
    routers:
      fabrique-preview-${slug}:
        rule: Host(\`${hostname}\`)
        service: fabrique-preview-${slug}
    services:
      fabrique-preview-${slug}:
        loadBalancer:
          servers:
            - url: http://host.docker.internal:${port}

cloudflared ingress before the 404 catch-all:
  - hostname: ${hostname}
    service: http://localhost:80

Cloudflare DNS if needed:
  cloudflared tunnel route dns <tunnel-id> ${hostname}
EOF
}
