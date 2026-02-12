#!/bin/bash
set -e

# =============================================================================
# Fleet Device Management - Development Server
# Features: Live log streaming, Go auto-reload on file changes
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Log files
LOG_DIR="$SCRIPT_DIR/.dev-logs"
mkdir -p "$LOG_DIR"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
DOCKER_LOG="$LOG_DIR/docker.log"

# PID tracking
PID_FILE="$LOG_DIR/.dev-pids"

# State files
DEV_STATE_FILE="$SCRIPT_DIR/.dev-state"

# Rebuild coordination
REBUILD_LOCK="$LOG_DIR/.rebuild.lock"

# Default configuration
BACKEND_PORT=9080
MYSQL_PORT=9306
REDIS_PORT=9379
DEV_LICENSE="--dev_license"

# MCP Server
MCP_PID_FILE="$LOG_DIR/.mcp-server.pid"

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${BOLD}Fleet Device Management - Dev Server${NC}                   ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[i]${NC} $1"
}

# =============================================================================
# Prerequisite Checks
# =============================================================================

prompt_install() {
    local name="$1"
    local install_cmd="$2"

    echo -n -e "${YELLOW}[?]${NC} Install ${name}? [Y/n] "
    read -r answer
    answer="${answer:-y}"
    if [[ "$answer" =~ ^[Yy] ]]; then
        echo -e "${CYAN}[i]${NC} Running: ${install_cmd}"
        if eval "$install_cmd"; then
            print_status "${name} installed successfully"
            return 0
        else
            print_error "Failed to install ${name}"
            return 1
        fi
    else
        return 1
    fi
}

check_prerequisites() {
    echo -e "${BOLD}Checking prerequisites...${NC}"
    local missing=0
    local has_brew=0

    if command -v brew &>/dev/null; then
        has_brew=1
    fi

    # Check Go
    if command -v go &>/dev/null; then
        local go_version=$(go version | awk '{print $3}')
        print_status "Go: $go_version"
    else
        print_error "Go is not installed."
        if [[ $has_brew -eq 1 ]]; then
            prompt_install "Go" "brew install go" || missing=1
        else
            print_info "Install from https://go.dev/dl/"
            missing=1
        fi
    fi

    # Check Node.js
    if command -v node &>/dev/null; then
        local node_version=$(node --version)
        print_status "Node.js: $node_version"
    else
        print_error "Node.js is not installed."
        if [[ $has_brew -eq 1 ]]; then
            prompt_install "Node.js" "brew install node" || missing=1
        else
            print_info "Install from https://nodejs.org/"
            missing=1
        fi
    fi

    # Check Yarn
    if command -v yarn &>/dev/null; then
        local yarn_version=$(yarn --version)
        print_status "Yarn: $yarn_version"
    else
        print_error "Yarn is not installed."
        if command -v npm &>/dev/null; then
            prompt_install "Yarn" "npm install -g yarn" || missing=1
        elif [[ $has_brew -eq 1 ]]; then
            prompt_install "Yarn" "brew install yarn" || missing=1
        else
            print_info "Install via: npm install -g yarn"
            missing=1
        fi
    fi

    # Check Docker
    if command -v docker &>/dev/null; then
        print_status "Docker: $(docker --version | awk '{print $3}' | tr -d ',')"
    else
        print_error "Docker is not installed."
        if [[ $has_brew -eq 1 ]]; then
            prompt_install "Docker Desktop" "brew install --cask docker" || missing=1
        else
            print_info "Install from https://www.docker.com/"
            missing=1
        fi
    fi

    # Check Docker Compose
    if docker compose version &>/dev/null; then
        print_status "Docker Compose: $(docker compose version --short)"
    else
        print_error "Docker Compose is not available."
        print_info "Docker Compose is included with Docker Desktop."
        missing=1
    fi

    if [[ $missing -eq 1 ]]; then
        echo ""
        print_error "Missing prerequisites. Please install them and try again."
        exit 1
    fi

    # Optional: fswatch for faster auto-reload
    if ! command -v fswatch &>/dev/null; then
        print_warning "fswatch not found (auto-reload will use slower polling)."
        if [[ $has_brew -eq 1 ]]; then
            prompt_install "fswatch" "brew install fswatch" || true
        else
            print_info "Install for faster auto-reload: brew install fswatch"
        fi
    else
        print_status "fswatch: $(fswatch --version 2>/dev/null | head -1 || echo 'installed')"
    fi

    echo ""
}

# =============================================================================
# Docker Services
# =============================================================================

start_docker_services() {
    echo -e "${BOLD}Starting Docker services (MySQL + Redis)...${NC}"

    # Start services (allow partial failure for port conflicts with other projects)
    docker compose up -d mysql redis >> "$DOCKER_LOG" 2>&1 || {
        print_warning "Docker compose returned non-zero. Checking if services are available anyway..."
    }

    # Wait for MySQL to be ready
    echo -n -e "${CYAN}[i]${NC} Waiting for MySQL to be ready"
    local retries=0
    local max_retries=60
    while ! docker compose exec -T mysql mysqladmin ping -h localhost -u root -ptoor --silent &>/dev/null; do
        echo -n "."
        sleep 2
        retries=$((retries + 1))
        if [[ $retries -ge $max_retries ]]; then
            echo ""
            print_error "MySQL failed to start after ${max_retries} attempts."
            print_info "Check logs: cat $DOCKER_LOG"
            exit 1
        fi
    done
    echo ""
    print_status "MySQL is ready on port $MYSQL_PORT"

    # Check Redis (may be running from another project on same port)
    if redis-cli -p $REDIS_PORT ping 2>/dev/null | grep -q "PONG"; then
        print_status "Redis is ready on port $REDIS_PORT"
    elif docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        print_status "Redis is ready on port $REDIS_PORT"
    else
        print_warning "Redis may not be ready yet, continuing..."
    fi
    echo ""
}

stop_docker_services() {
    echo -e "${BOLD}Stopping Docker services...${NC}"
    docker compose down 2>/dev/null
    print_status "Docker services stopped"
}

# =============================================================================
# Build & Prepare
# =============================================================================

install_deps() {
    echo -e "${BOLD}Installing dependencies...${NC}"
    yarn install --ignore-engines 2>&1 | tail -3
    print_status "JavaScript dependencies installed"
    echo ""
}

build_fleet() {
    echo -e "${BOLD}Building Fleet binary...${NC}"
    if ! make fleet; then
        print_error "Fleet binary build failed. Check network connectivity and Go dependencies."
        exit 1
    fi
    print_status "Fleet binary built: ./build/fleet"
    echo ""
}

prepare_db() {
    echo -e "${BOLD}Preparing database...${NC}"

    # Check if database exists and has tables
    local table_count=$(docker compose exec -T mysql bash -c 'echo "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"fleet\";" | MYSQL_PWD=toor mysql -uroot -N' 2>/dev/null || echo "0")

    if [[ "$table_count" -gt "5" ]]; then
        print_status "Database already prepared ($table_count tables found)"
    else
        FLEET_MYSQL_ADDRESS=localhost:$MYSQL_PORT ./build/fleet prepare db --dev 2>&1
        print_status "Database migrations applied"
    fi
    echo ""
}

generate_assets() {
    echo -e "${BOLD}Generating frontend assets...${NC}"
    NODE_ENV=development yarn --ignore-engines run webpack --progress 2>&1 | tail -3
    go run github.com/kevinburke/go-bindata/go-bindata -debug -pkg=bindata -tags full \
        -o=server/bindata/generated.go \
        frontend/templates/ assets/... server/mail/templates 2>&1
    print_status "Frontend assets generated"
    echo ""
}

# =============================================================================
# Process Management
# =============================================================================

shutdown() {
    # Guard against running twice (Ctrl+C during cleanup)
    if [[ -n "${SHUTTING_DOWN:-}" ]]; then return; fi
    SHUTTING_DOWN=1

    echo ""
    echo -e "${BOLD}Shutting down...${NC}"

    # Kill tracked processes
    if [[ -f "$PID_FILE" ]]; then
        while read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi

    # Kill any webpack watch process
    pkill -f "webpack.*--watch" 2>/dev/null || true

    # Kill any lingering fswatch for this project
    pkill -f "fswatch.*server.*cmd/fleet" 2>/dev/null || true

    # Remove stale rebuild lock
    rmdir "$REBUILD_LOCK" 2>/dev/null || true

    print_status "Dev server stopped"
    echo -e "${CYAN}Docker services are still running. To stop: docker compose down${NC}"
    echo ""

    exit 0
}

trap shutdown INT TERM
trap 'if [[ -z "${SHUTTING_DOWN:-}" ]]; then shutdown; fi' EXIT

track_pid() {
    echo "$1" >> "$PID_FILE"
}

# =============================================================================
# Live Log Streaming
# =============================================================================

start_log_streaming() {
    # Truncate log files for a fresh session
    : > "$BACKEND_LOG"
    : > "$FRONTEND_LOG"

    # Stream backend logs with cyan [backend] prefix
    tail -f "$BACKEND_LOG" 2>/dev/null | awk '{print "\033[0;36m[backend]\033[0m " $0; fflush()}' &
    track_pid $!

    # Stream frontend/webpack logs with yellow [webpack] prefix
    tail -f "$FRONTEND_LOG" 2>/dev/null | awk '{print "\033[1;33m[webpack]\033[0m " $0; fflush()}' &
    track_pid $!

    print_status "Live log streaming started"
}

# =============================================================================
# Auto-Reload
# =============================================================================

auto_rebuild() {
    local reason="${1:-manual}"

    # Acquire rebuild lock (atomic via mkdir)
    if ! mkdir "$REBUILD_LOCK" 2>/dev/null; then
        print_warning "Rebuild already in progress, skipping ($reason)"
        return 0
    fi

    echo ""
    echo -e "${YELLOW}[rebuild]${NC} Rebuilding Fleet binary (${reason})..."

    # Kill the running backend
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    sleep 1

    # Build the Go binary
    if make fleet 2>&1 | tail -5; then
        print_status "[rebuild] Build succeeded"
    else
        print_error "[rebuild] Build FAILED -- fix errors and save to retry"
        rmdir "$REBUILD_LOCK" 2>/dev/null || true
        return 1
    fi

    # Start the new backend (uses >> append)
    FLEET_MYSQL_ADDRESS=localhost:$MYSQL_PORT \
    FLEET_REDIS_ADDRESS=localhost:$REDIS_PORT \
    ./build/fleet serve --dev $DEV_LICENSE \
        --server_address=localhost:$BACKEND_PORT \
        >> "$BACKEND_LOG" 2>&1 &
    local backend_pid=$!
    track_pid $backend_pid

    sleep 2
    if kill -0 $backend_pid 2>/dev/null; then
        print_status "[rebuild] Backend restarted (PID: $backend_pid)"
    else
        print_error "[rebuild] Backend failed to start after rebuild"
        rmdir "$REBUILD_LOCK" 2>/dev/null || true
        return 1
    fi

    rmdir "$REBUILD_LOCK" 2>/dev/null || true
}

start_go_watcher() {
    echo -e "${BOLD}Starting Go file watcher...${NC}"

    # Clean up stale rebuild lock from previous session
    rmdir "$REBUILD_LOCK" 2>/dev/null || true

    if command -v fswatch &>/dev/null; then
        start_go_watcher_fswatch
    else
        print_info "fswatch not found, using polling (install for faster reload: brew install fswatch)"
        start_go_watcher_polling
    fi
}

start_go_watcher_fswatch() {
    # fswatch flags:
    #   -o     = one-per-batch (emit count, not file names)
    #   -l 2   = 2-second latency (debounce)
    #   -r     = recursive
    #   -e/--exclude, -i/--include for filtering
    fswatch -o -l 2 -r \
        -e ".*" \
        -i "\\.go$" \
        -e "generated\\.go$" \
        "$SCRIPT_DIR/server" \
        "$SCRIPT_DIR/cmd/fleet" \
        "$SCRIPT_DIR/ee/server" \
    2>/dev/null | while read -r _count; do
        auto_rebuild "Go files changed"
    done &

    track_pid $!
    print_status "Go auto-reload enabled (fswatch, 2s debounce)"
}

start_go_watcher_polling() {
    local marker="$LOG_DIR/.go-watcher-marker"
    touch "$marker"

    (
        while true; do
            sleep 3

            # Check for .go files newer than the marker
            local changed
            changed=$(find "$SCRIPT_DIR/server" "$SCRIPT_DIR/cmd/fleet" "$SCRIPT_DIR/ee/server" \
                -name "*.go" \
                -newer "$marker" \
                ! -name "generated.go" \
                ! -path "*/.git/*" \
                2>/dev/null | head -1)

            if [[ -n "$changed" ]]; then
                touch "$marker"
                auto_rebuild "Go files changed"
            fi
        done
    ) &

    track_pid $!
    print_status "Go auto-reload enabled (polling, 3s interval)"
}

# =============================================================================
# Server Start
# =============================================================================

start_backend() {
    echo -e "${BOLD}Starting Fleet backend on port $BACKEND_PORT...${NC}"

    # Kill any existing fleet process on the port
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    sleep 1

    FLEET_MYSQL_ADDRESS=localhost:$MYSQL_PORT \
    FLEET_REDIS_ADDRESS=localhost:$REDIS_PORT \
    ./build/fleet serve --dev $DEV_LICENSE \
        --server_address=localhost:$BACKEND_PORT \
        >> "$BACKEND_LOG" 2>&1 &
    local backend_pid=$!
    track_pid $backend_pid

    sleep 2
    if kill -0 $backend_pid 2>/dev/null; then
        print_status "Backend started (PID: $backend_pid)"
    else
        print_error "Backend failed to start. Check: cat $BACKEND_LOG"
        return 1
    fi
}

start_frontend_watch() {
    echo -e "${BOLD}Starting frontend watcher...${NC}"

    NODE_ENV=development yarn --ignore-engines run webpack --progress --watch >> "$FRONTEND_LOG" 2>&1 &
    local frontend_pid=$!
    track_pid $frontend_pid
    print_status "Frontend watcher started (PID: $frontend_pid)"
}

# =============================================================================
# Status Display
# =============================================================================

show_status() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${BOLD}Dev Server Status${NC}                                      ${BLUE}║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║${NC}                                                          ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}Backend:${NC}    https://localhost:$BACKEND_PORT                  ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}MySQL:${NC}      localhost:$MYSQL_PORT (fleet/insecure)          ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}Redis:${NC}      localhost:$REDIS_PORT                           ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}                                                          ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}Admin:${NC}      Set up at https://localhost:$BACKEND_PORT/setup  ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}                                                          ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}Auto-reload:${NC} Watching .go files for changes              ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}Live logs:${NC}   Streaming ${CYAN}[backend]${NC} + ${YELLOW}[webpack]${NC}              ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}                                                          ${BLUE}║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║${NC}  ${BOLD}Commands:${NC}  s=status  r=rebuild  b=full rebuild           ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}             l=logs    d=db reset  h=help  q=quit         ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

show_help() {
    echo ""
    echo -e "${BOLD}Interactive Commands:${NC}"
    echo -e "  ${GREEN}s${NC}  Show status and connection info"
    echo -e "  ${GREEN}r${NC}  Rebuild Go binary and restart backend"
    echo -e "  ${GREEN}b${NC}  Full rebuild (regenerate assets + rebuild binary + restart)"
    echo -e "  ${GREEN}l${NC}  Show last 50 lines of backend log"
    echo -e "  ${GREEN}d${NC}  Reset database (drop + recreate + migrate)"
    echo -e "  ${GREEN}h${NC}  Show this help"
    echo -e "  ${GREEN}q${NC}  Quit dev server"
    echo ""
    echo -e "${BOLD}Auto-reload:${NC}"
    echo -e "  Go file changes in server/, cmd/fleet/, ee/server/ trigger automatic rebuild."
    echo -e "  Frontend changes are picked up by webpack --watch automatically."
    echo -e "  Logs stream live with ${CYAN}[backend]${NC} and ${YELLOW}[webpack]${NC} prefixes."
    echo ""
    echo -e "${BOLD}CLI Commands:${NC}"
    echo -e "  ${CYAN}./start-dev.sh${NC}              Start full dev environment"
    echo -e "  ${CYAN}./start-dev.sh backend${NC}      Start backend only (Docker + server)"
    echo -e "  ${CYAN}./start-dev.sh frontend${NC}     Start frontend watcher only"
    echo -e "  ${CYAN}./start-dev.sh status${NC}       Show current status"
    echo -e "  ${CYAN}./start-dev.sh stop${NC}         Stop all services"
    echo -e "  ${CYAN}./start-dev.sh db-reset${NC}     Reset the database"
    echo -e "  ${CYAN}./start-dev.sh logs${NC}         Tail backend logs"
    echo ""
}

# =============================================================================
# Interactive Mode
# =============================================================================

interactive_loop() {
    show_status
    echo -e "${CYAN}Logs streaming below. Press keys for commands (h=help, q=quit).${NC}"
    echo ""

    while true; do
        # Non-blocking read with 1-second timeout so logs can flow
        if read -rsn1 -t 1 key; then
            case "$key" in
                s)
                    show_status
                    ;;
                r)
                    auto_rebuild "manual restart"
                    ;;
                b)
                    echo -e "${YELLOW}Full rebuild (assets + binary)...${NC}"
                    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
                    generate_assets
                    auto_rebuild "manual full rebuild"
                    ;;
                l)
                    echo -e "${CYAN}--- Last 50 lines of backend log ---${NC}"
                    tail -50 "$BACKEND_LOG"
                    echo -e "${CYAN}--- end ---${NC}"
                    ;;
                d)
                    echo -e "${YELLOW}Resetting database...${NC}"
                    docker compose exec -T mysql bash -c 'echo "drop database if exists fleet; create database fleet;" | MYSQL_PWD=toor mysql -uroot'
                    FLEET_MYSQL_ADDRESS=localhost:$MYSQL_PORT ./build/fleet prepare db --dev
                    print_status "Database reset complete"
                    ;;
                h)
                    show_help
                    ;;
                q)
                    shutdown
                    ;;
                *)
                    ;;
            esac
        fi
    done
}

# =============================================================================
# MCP Server Setup
# =============================================================================

setup_mcp() {
    echo -e "${BOLD}Setting up MCP server for AI tools...${NC}"

    local mcp_config='{
  "mcpServers": {
    "fleet-dev": {
      "command": "uv",
      "args": ["run", "--with", "mcp", "python", "scripts/development/mcp_dev_server.py"],
      "cwd": "'"$SCRIPT_DIR"'"
    }
  }
}'

    # Auto-configure for Claude Code
    local claude_config_dir="$HOME/.claude"
    if [[ -d "$claude_config_dir" ]]; then
        local claude_mcp="$SCRIPT_DIR/.claude/mcp.json"
        if [[ ! -f "$claude_mcp" ]]; then
            echo "$mcp_config" > "$claude_mcp"
            print_status "MCP config written to .claude/mcp.json"
        else
            print_info "MCP config already exists at .claude/mcp.json"
        fi
    fi

    # Auto-configure for Cursor
    local cursor_config="$SCRIPT_DIR/.cursor/mcp.json"
    mkdir -p "$SCRIPT_DIR/.cursor"
    if [[ ! -f "$cursor_config" ]]; then
        echo "$mcp_config" > "$cursor_config"
        print_status "MCP config written to .cursor/mcp.json"
    else
        print_info "MCP config already exists at .cursor/mcp.json"
    fi

    print_status "MCP server configured for AI tools"
    print_info "Tools available: logs, restart, rebuild, db queries, API calls, tests"
    echo ""
}

# =============================================================================
# Main Commands
# =============================================================================

cmd_full_start() {
    print_header
    check_prerequisites
    start_docker_services
    install_deps
    generate_assets
    build_fleet
    prepare_db
    setup_mcp
    start_log_streaming
    start_backend
    start_frontend_watch
    start_go_watcher
    interactive_loop
}

cmd_backend() {
    print_header
    check_prerequisites
    start_docker_services
    install_deps
    generate_assets
    build_fleet
    prepare_db
    setup_mcp
    start_log_streaming
    start_backend
    start_go_watcher
    interactive_loop
}

cmd_frontend() {
    print_header
    echo -e "${BOLD}Starting frontend watcher only...${NC}"
    install_deps
    generate_assets
    start_frontend_watch
    echo ""
    print_info "Frontend watcher running. Press Ctrl+C to stop."
    wait
}

cmd_status() {
    show_status

    # Check if processes are running
    if lsof -ti:$BACKEND_PORT &>/dev/null; then
        print_status "Backend is running on port $BACKEND_PORT"
    else
        print_warning "Backend is NOT running"
    fi

    if docker compose ps mysql 2>/dev/null | grep -q "running"; then
        print_status "MySQL is running"
    else
        print_warning "MySQL is NOT running"
    fi

    if docker compose ps redis 2>/dev/null | grep -q "running"; then
        print_status "Redis is running"
    else
        print_warning "Redis is NOT running"
    fi
    echo ""
}

cmd_stop() {
    echo -e "${BOLD}Stopping all dev services...${NC}"
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    pkill -f "webpack.*--watch" 2>/dev/null || true
    pkill -f "fswatch.*server.*cmd/fleet" 2>/dev/null || true
    stop_docker_services
    rm -f "$PID_FILE"
    rmdir "$REBUILD_LOCK" 2>/dev/null || true
    print_status "All services stopped"
}

cmd_db_reset() {
    echo -e "${BOLD}Resetting database...${NC}"
    docker compose exec -T mysql bash -c 'echo "drop database if exists fleet; create database fleet;" | MYSQL_PWD=toor mysql -uroot'
    FLEET_MYSQL_ADDRESS=localhost:$MYSQL_PORT ./build/fleet prepare db --dev
    print_status "Database reset complete"
}

cmd_logs() {
    echo -e "${CYAN}--- Tailing backend logs (Ctrl+C to stop) ---${NC}"
    tail -f "$BACKEND_LOG"
}

# =============================================================================
# Entry Point
# =============================================================================

case "${1:-}" in
    backend)
        cmd_backend
        ;;
    frontend)
        cmd_frontend
        ;;
    status)
        cmd_status
        ;;
    stop)
        cmd_stop
        ;;
    db-reset)
        cmd_db_reset
        ;;
    logs)
        cmd_logs
        ;;
    help|--help|-h)
        show_help
        ;;
    ""|start)
        cmd_full_start
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
