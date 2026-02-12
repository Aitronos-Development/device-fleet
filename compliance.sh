#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="device-fleet"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Color support
if [ -t 1 ]; then
  RESET="\033[0m"; BOLD="\033[1m"
  FG_RED="\033[31m"; FG_GREEN="\033[32m"; FG_YELLOW="\033[33m"
  FG_BLUE="\033[34m"; FG_CYAN="\033[36m"; FG_GRAY="\033[90m"
  FG_MAGENTA="\033[35m"
else
  RESET=""; BOLD=""; FG_RED=""; FG_GREEN=""; FG_YELLOW=""
  FG_BLUE=""; FG_CYAN=""; FG_GRAY=""; FG_MAGENTA=""
fi

OK="✓"; ERROR="✗"; INFO="ℹ"; WARN="⚠"; STEP="→"

log_ok()    { printf "%b\n" "${FG_GREEN}${OK} [PASS]${RESET}  $*"; }
log_error() { printf "%b\n" "${FG_RED}${ERROR} [FAIL]${RESET}  $*"; }
log_info()  { printf "%b\n" "${FG_BLUE}${INFO} [INFO]${RESET}  $*"; }
log_warn()  { printf "%b\n" "${FG_YELLOW}${WARN} [WARN]${RESET}  $*"; }
log_step()  { printf "%b\n" "${FG_CYAN}${STEP}${RESET} $*"; }
log_header() { printf "\n%b\n" "${BOLD}${FG_MAGENTA}═══ $* ═══${RESET}"; }

has_tool() { command -v "$1" > /dev/null 2>&1; }

# Mode detection
MODE="${1:-fast}"
AUTO_FIX=false

case "$MODE" in
  --help|-h|help)
    printf "%b\n" "${BOLD}${FG_CYAN}device-fleet Compliance${RESET}"
    printf "%b\n" ""
    printf "%b\n" "${BOLD}USAGE:${RESET}"
    printf "%b\n" "  $0             # Fast mode (default)"
    printf "%b\n" "  $0 fast        # Fast mode - lint & format checks"
    printf "%b\n" "  $0 full        # Full mode - includes builds & tests"
    printf "%b\n" "  $0 fix         # Auto-fix all fixable issues"
    printf "%b\n" "  $0 ci          # CI mode (same as full)"
    printf "%b\n" ""
    printf "%b\n" "${BOLD}CHECKS:${RESET}"
    printf "%b\n" "  Go:         golangci-lint, gofmt, go build (full)"
    printf "%b\n" "  TypeScript: eslint, prettier, npm test (full)"
    printf "%b\n" ""
    exit 0
    ;;
  --fix|fix)
    AUTO_FIX=true
    MODE="fast"
    ;;
  fast|full|ci)
    # Valid modes
    ;;
  *)
    log_error "Unknown mode: $MODE"
    exit 1
    ;;
esac

# Check counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
SKIPPED_CHECKS=0

check_golangci_lint() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  if ! has_tool golangci-lint; then
    SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
    log_warn "Skipping golangci-lint - not installed"
    return 0
  fi

  log_step "Running golangci-lint..."

  if [[ "$AUTO_FIX" == true ]]; then
    if golangci-lint run --fix > /dev/null 2>&1; then
      PASSED_CHECKS=$((PASSED_CHECKS + 1))
      log_ok "golangci-lint fixed issues"
      return 0
    else
      FAILED_CHECKS=$((FAILED_CHECKS + 1))
      log_error "golangci-lint found issues that couldn't be auto-fixed"
      return 1
    fi
  fi

  local lint_cmd="golangci-lint run"
  [[ "$MODE" == "fast" ]] && lint_cmd="golangci-lint run --fast"

  if $lint_cmd > /dev/null 2>&1; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    log_ok "golangci-lint passed"
    return 0
  else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    log_error "golangci-lint failed"
    return 1
  fi
}

check_gofmt() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  if ! has_tool gofmt; then
    SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
    log_warn "Skipping gofmt - not installed"
    return 0
  fi

  log_step "Running gofmt..."

  if [[ "$AUTO_FIX" == true ]]; then
    gofmt -w . > /dev/null 2>&1
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    log_ok "gofmt formatted code"
    return 0
  fi

  local unformatted
  unformatted=$(gofmt -l . 2>/dev/null | grep -v vendor || true)

  if [[ -z "$unformatted" ]]; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    log_ok "gofmt passed"
    return 0
  else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    log_error "gofmt found unformatted files"
    return 1
  fi
}

check_eslint() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  if ! has_tool npx; then
    SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
    log_warn "Skipping eslint - npx not installed"
    return 0
  fi

  if [ ! -f "$PROJECT_DIR/package.json" ]; then
    SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
    log_warn "Skipping eslint - package.json not found"
    return 0
  fi

  log_step "Running eslint..."

  if [[ "$AUTO_FIX" == true ]]; then
    if npx eslint frontend --ext .js,.jsx,.ts,.tsx --fix > /dev/null 2>&1; then
      PASSED_CHECKS=$((PASSED_CHECKS + 1))
      log_ok "eslint fixed issues"
      return 0
    else
      FAILED_CHECKS=$((FAILED_CHECKS + 1))
      log_error "eslint found issues that couldn't be auto-fixed"
      return 1
    fi
  fi

  if npx eslint frontend --ext .js,.jsx,.ts,.tsx > /dev/null 2>&1; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    log_ok "eslint passed"
    return 0
  else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    log_error "eslint failed"
    return 1
  fi
}

check_prettier() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  if ! has_tool npx; then
    SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
    log_warn "Skipping prettier - npx not installed"
    return 0
  fi

  if [ ! -f "$PROJECT_DIR/package.json" ]; then
    SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
    log_warn "Skipping prettier - package.json not found"
    return 0
  fi

  log_step "Running prettier..."

  if [[ "$AUTO_FIX" == true ]]; then
    npx prettier --write "frontend/**/*.{jsx,js,tsx,ts}" > /dev/null 2>&1
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    log_ok "prettier formatted code"
    return 0
  fi

  if npx prettier --check "frontend/**/*.{jsx,js,tsx,ts}" > /dev/null 2>&1; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    log_ok "prettier passed"
    return 0
  else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    log_error "prettier found formatting issues"
    return 1
  fi
}

check_go_build() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  if ! has_tool go; then
    SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
    log_warn "Skipping go build - go not installed"
    return 0
  fi

  log_step "Running go build..."

  if go build ./... > /dev/null 2>&1; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    log_ok "go build passed"
    return 0
  else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    log_error "go build failed"
    return 1
  fi
}

check_npm_test() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  if ! has_tool npm; then
    SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
    log_warn "Skipping npm test - npm not installed"
    return 0
  fi

  if [ ! -f "$PROJECT_DIR/package.json" ]; then
    SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
    log_warn "Skipping npm test - package.json not found"
    return 0
  fi

  log_step "Running npm test..."

  if npm test > /dev/null 2>&1; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    log_ok "npm test passed"
    return 0
  else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    log_error "npm test failed"
    return 1
  fi
}

main() {
  log_header "$PROJECT_NAME Compliance - $MODE mode"

  cd "$PROJECT_DIR"

  # Fast mode checks
  check_golangci_lint || true
  check_gofmt || true
  check_eslint || true
  check_prettier || true

  # Full mode checks
  if [[ "$MODE" == "full" || "$MODE" == "ci" ]]; then
    check_go_build || true
    check_npm_test || true
  fi

  # Summary
  log_header "Summary"
  log_info "Total: $TOTAL_CHECKS checks"
  [[ $PASSED_CHECKS -gt 0 ]] && log_ok "Passed: $PASSED_CHECKS"
  [[ $FAILED_CHECKS -gt 0 ]] && log_error "Failed: $FAILED_CHECKS"
  [[ $SKIPPED_CHECKS -gt 0 ]] && log_warn "Skipped: $SKIPPED_CHECKS"

  if [[ $SKIPPED_CHECKS -eq $TOTAL_CHECKS ]]; then
    log_warn "All checks skipped - required tools not installed"
    exit 2
  fi

  if [[ $FAILED_CHECKS -gt 0 ]]; then
    log_error "Compliance check failed"
    exit 1
  fi

  log_ok "All checks passed"
  exit 0
}

main "$@"
