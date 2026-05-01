#!/usr/bin/env bash
set -u

DOMAIN="${1:-dormglide.com}"
WWW_DOMAIN="www.${DOMAIN}"

section() {
  printf "\n== %s ==\n" "$1"
}

ok() {
  printf "[OK] %s\n" "$1"
}

warn() {
  printf "[WARN] %s\n" "$1"
}

fail() {
  printf "[FAIL] %s\n" "$1"
}

run_cmd() {
  printf "$ %s\n" "$*"
  "$@" 2>&1 || true
}

section "DormGlide Connectivity Diagnostics"
printf "Date: %s\n" "$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
printf "Host: %s\n" "$(hostname 2>/dev/null || echo unknown)"
printf "Domain: %s\n" "$DOMAIN"

section "1) Hosts file override check"
if [[ -f /etc/hosts ]]; then
  HOST_HITS="$(grep -nEi "(^|[[:space:]])(${DOMAIN}|${WWW_DOMAIN})([[:space:]]|$)" /etc/hosts || true)"
  if [[ -n "$HOST_HITS" ]]; then
    fail "Found /etc/hosts entries that may hijack ${DOMAIN}:"
    printf "%s\n" "$HOST_HITS"
    warn "If these map to 127.0.0.1/0.0.0.0, remove those lines and retry."
  else
    ok "No ${DOMAIN} entries found in /etc/hosts"
  fi
else
  warn "/etc/hosts not readable"
fi

section "2) Proxy environment check"
PROXY_VARS="$(env | grep -Ei '^(http|https|all|no)_proxy=' || true)"
if [[ -n "$PROXY_VARS" ]]; then
  warn "Proxy-related env vars are set:"
  printf "%s\n" "$PROXY_VARS"
  warn "Unexpected corporate or local proxies can cause ERR_CONNECTION_REFUSED."
else
  ok "No proxy env vars detected"
fi

section "3) DNS resolution"
if command -v getent >/dev/null 2>&1; then
  DNS_OUT="$(getent ahosts "$DOMAIN" || true)"
  if [[ -n "$DNS_OUT" ]]; then
    printf "%s\n" "$DNS_OUT"
    if printf "%s\n" "$DNS_OUT" | grep -Eq '185\.199\.(108|109|110|111)\.153'; then
      ok "DNS includes expected GitHub Pages IP range"
    else
      warn "DNS does not show expected GitHub Pages IPs"
    fi
  else
    fail "No DNS result via getent"
  fi
else
  warn "getent not available"
fi

section "4) TCP connectivity"
if command -v timeout >/dev/null 2>&1; then
  if timeout 8 bash -lc "cat < /dev/null > /dev/tcp/${DOMAIN}/443"; then
    ok "TCP 443 reachable"
  else
    fail "TCP 443 not reachable"
  fi

  if timeout 8 bash -lc "cat < /dev/null > /dev/tcp/${DOMAIN}/80"; then
    ok "TCP 80 reachable"
  else
    fail "TCP 80 not reachable"
  fi
else
  warn "timeout not available; skipping /dev/tcp checks"
fi

section "5) HTTP/HTTPS response check"
if command -v curl >/dev/null 2>&1; then
  run_cmd curl -I --max-time 15 "https://${DOMAIN}"
  run_cmd curl -I --max-time 15 "https://${DOMAIN}/app.html"
  run_cmd curl -I --max-time 15 "https://${WWW_DOMAIN}"
else
  fail "curl is not installed"
fi

section "6) TLS certificate summary"
if command -v openssl >/dev/null 2>&1; then
  printf "$ openssl s_client -servername %s -connect %s:443 | openssl x509 -noout -subject -issuer -dates\n" "$DOMAIN" "$DOMAIN"
  echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>&1 || true
else
  warn "openssl not available"
fi

section "Likely interpretation"
printf '%s\n' "- If DNS and curl here are good but browser still fails: local browser cache/extension/proxy/firewall issue."
printf '%s\n' "- If TCP 443 fails: network/firewall/router or ISP block."
printf '%s\n' "- If /etc/hosts has local mappings: remove them and retry."
printf '%s\n' "- If proxy vars are set unexpectedly: unset them for this shell and test again."

section "Suggested quick fixes"
printf "1) Disable extensions and test in incognito.\n"
printf "2) Clear Chrome DNS and sockets: chrome://net-internals/#dns and #sockets.\n"
printf "3) Flush DNS cache: sudo resolvectl flush-caches (Linux).\n"
printf "4) Compare from mobile data to isolate router/ISP issues.\n"
