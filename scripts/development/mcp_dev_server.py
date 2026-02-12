#!/usr/bin/env python3
"""
Fleet Device Management - MCP Development Server

Provides AI assistants (Claude, Cursor, etc.) with tools to:
- Read backend and frontend logs
- Restart the dev server
- Check service status
- Query the MySQL database (read-only)
- Call Fleet API endpoints
- Reset the database

Usage:
    uv run --with mcp python scripts/development/mcp_dev_server.py
"""

import argparse
import json
import os
import signal
import subprocess
import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
LOG_DIR = PROJECT_ROOT / ".dev-logs"
BACKEND_LOG = LOG_DIR / "backend.log"
FRONTEND_LOG = LOG_DIR / "frontend.log"
DOCKER_LOG = LOG_DIR / "docker.log"

# Dev server config
BACKEND_PORT = 8080
MYSQL_PORT = 3306
MYSQL_USER = "fleet"
MYSQL_PASSWORD = "insecure"
MYSQL_ROOT_PASSWORD = "toor"
MYSQL_DATABASE = "fleet"
REDIS_PORT = 6379

mcp = FastMCP(
    "fleet-dev",
    description="Fleet Device Management development server - logs, commands, status, database",
)


# =============================================================================
# Helper Functions
# =============================================================================


def read_log_lines(log_path: Path, lines: int = 250, offset: int = 0) -> str:
    """Read the last N lines from a log file with optional offset."""
    if not log_path.exists():
        return f"Log file not found: {log_path}"

    try:
        with open(log_path, "r", errors="replace") as f:
            all_lines = f.readlines()

        if offset > 0:
            all_lines = all_lines[:-offset] if offset < len(all_lines) else []

        selected = all_lines[-lines:] if lines < len(all_lines) else all_lines
        return "".join(selected)
    except Exception as e:
        return f"Error reading log: {e}"


def run_command(cmd: list[str], timeout: int = 30, cwd: str | None = None) -> str:
    """Run a shell command and return output."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd or str(PROJECT_ROOT),
        )
        output = result.stdout
        if result.stderr:
            output += "\n--- stderr ---\n" + result.stderr
        if result.returncode != 0:
            output += f"\n[exit code: {result.returncode}]"
        return output.strip()
    except subprocess.TimeoutExpired:
        return f"Command timed out after {timeout}s"
    except Exception as e:
        return f"Error running command: {e}"


def mysql_query(query: str, use_root: bool = False) -> str:
    """Execute a MySQL query via docker compose exec."""
    user = "root" if use_root else MYSQL_USER
    password = MYSQL_ROOT_PASSWORD if use_root else MYSQL_PASSWORD

    cmd = [
        "docker", "compose", "exec", "-T", "mysql",
        "mysql",
        f"-u{user}",
        f"-p{password}",
        MYSQL_DATABASE,
        "-e", query,
        "--table",
    ]
    return run_command(cmd, timeout=15)


# =============================================================================
# Log Tools
# =============================================================================


@mcp.tool()
def get_backend_logs(lines: int = 250, offset: int = 0) -> str:
    """Get the most recent backend (Fleet server) logs.

    Args:
        lines: Number of lines to retrieve (default 250)
        offset: Skip this many lines from the end (for pagination)
    """
    return read_log_lines(BACKEND_LOG, lines, offset)


@mcp.tool()
def get_frontend_logs(lines: int = 250, offset: int = 0) -> str:
    """Get the most recent frontend (webpack) logs.

    Args:
        lines: Number of lines to retrieve (default 250)
        offset: Skip this many lines from the end (for pagination)
    """
    return read_log_lines(FRONTEND_LOG, lines, offset)


@mcp.tool()
def get_docker_logs(lines: int = 100, offset: int = 0) -> str:
    """Get the Docker compose startup logs.

    Args:
        lines: Number of lines to retrieve (default 100)
        offset: Skip this many lines from the end (for pagination)
    """
    return read_log_lines(DOCKER_LOG, lines, offset)


@mcp.tool()
def tail_logs(service: str = "backend", lines: int = 50) -> str:
    """Tail live logs from a service using docker or log files.

    Args:
        service: Service to tail - "backend", "frontend", "mysql", "redis"
        lines: Number of lines to show
    """
    if service == "backend":
        return read_log_lines(BACKEND_LOG, lines)
    elif service == "frontend":
        return read_log_lines(FRONTEND_LOG, lines)
    elif service == "mysql":
        return run_command(
            ["docker", "compose", "logs", "--tail", str(lines), "mysql"]
        )
    elif service == "redis":
        return run_command(
            ["docker", "compose", "logs", "--tail", str(lines), "redis"]
        )
    else:
        return f"Unknown service: {service}. Available: backend, frontend, mysql, redis"


# =============================================================================
# Dev Command Tools
# =============================================================================


@mcp.tool()
def restart_backend() -> str:
    """Restart the Fleet backend server.

    Kills the existing fleet process on port 8080 and starts a new one.
    """
    # Kill existing process
    kill_result = run_command(
        ["bash", "-c", f"lsof -ti:{BACKEND_PORT} | xargs kill -9 2>/dev/null || true"]
    )

    # Start new server
    start_result = run_command(
        ["bash", "-c",
         f"./build/fleet serve --dev --dev_license "
         f"--server_address=localhost:{BACKEND_PORT} "
         f"> {BACKEND_LOG} 2>&1 &"
         f" echo $!"],
        timeout=5,
    )

    return f"Backend restarted. New PID: {start_result.strip()}"


@mcp.tool()
def rebuild_and_restart() -> str:
    """Full rebuild: regenerate assets, rebuild Go binary, restart server.

    This is equivalent to pressing 'b' in the interactive dev server.
    """
    steps = []

    # Generate webpack assets
    steps.append("=== Generating frontend assets ===")
    result = run_command(
        ["bash", "-c",
         "NODE_ENV=development yarn --ignore-engines run webpack --progress"],
        timeout=120,
    )
    steps.append(result[-500:] if len(result) > 500 else result)

    # Generate go-bindata
    steps.append("\n=== Generating go-bindata ===")
    result = run_command(
        ["bash", "-c",
         "go run github.com/kevinburke/go-bindata/go-bindata -debug -pkg=bindata "
         "-tags full -o=server/bindata/generated.go "
         "frontend/templates/ assets/... server/mail/templates"],
        timeout=60,
    )
    steps.append(result if result else "OK")

    # Build fleet binary
    steps.append("\n=== Building Fleet binary ===")
    result = run_command(["make", "fleet"], timeout=300)
    steps.append(result[-500:] if len(result) > 500 else result)

    # Restart
    steps.append("\n=== Restarting backend ===")
    steps.append(restart_backend())

    return "\n".join(steps)


@mcp.tool()
def reset_database() -> str:
    """Drop and recreate the Fleet database, then run all migrations.

    WARNING: This will delete all data in the dev database.
    """
    # Drop and recreate
    drop_result = run_command(
        ["docker", "compose", "exec", "-T", "mysql",
         "bash", "-c",
         'echo "drop database if exists fleet; create database fleet;" | MYSQL_PWD=toor mysql -uroot'],
        timeout=15,
    )

    # Run migrations
    migrate_result = run_command(
        ["./build/fleet", "prepare", "db", "--dev"],
        timeout=60,
    )

    return f"Database reset:\n{drop_result}\n\nMigrations:\n{migrate_result[-1000:]}"


@mcp.tool()
def get_current_status() -> dict:
    """Get the current status of all dev services.

    Returns health info for backend, MySQL, Redis, and process info.
    """
    status = {}

    # Backend
    backend_check = run_command(
        ["bash", "-c", f"lsof -ti:{BACKEND_PORT} 2>/dev/null"]
    )
    status["backend"] = {
        "running": bool(backend_check.strip()),
        "pid": backend_check.strip() if backend_check.strip() else None,
        "url": f"https://localhost:{BACKEND_PORT}",
    }

    # MySQL
    mysql_check = run_command(
        ["docker", "compose", "exec", "-T", "mysql",
         "mysqladmin", "ping", "-h", "localhost", "-uroot", "-ptoor", "--silent"],
        timeout=5,
    )
    status["mysql"] = {
        "running": "alive" in mysql_check.lower(),
        "port": MYSQL_PORT,
        "database": MYSQL_DATABASE,
        "user": MYSQL_USER,
    }

    # Redis
    redis_check = run_command(
        ["bash", "-c", f"redis-cli -p {REDIS_PORT} ping 2>/dev/null || "
         "docker compose exec -T redis redis-cli ping 2>/dev/null"],
        timeout=5,
    )
    status["redis"] = {
        "running": "PONG" in redis_check,
        "port": REDIS_PORT,
    }

    # Docker containers
    docker_ps = run_command(
        ["docker", "compose", "ps", "--format", "json"],
        timeout=10,
    )
    status["docker"] = docker_ps

    return status


# =============================================================================
# API Tools
# =============================================================================


@mcp.tool()
def call_fleet_api(
    endpoint: str,
    method: str = "GET",
    body: str | None = None,
    api_token: str | None = None,
) -> str:
    """Call a Fleet API endpoint.

    Args:
        endpoint: API path, e.g. "/api/v1/fleet/hosts" (leading slash required)
        method: HTTP method (GET, POST, PUT, PATCH, DELETE)
        body: JSON body for POST/PUT/PATCH requests
        api_token: Optional API token for authentication
    """
    url = f"https://localhost:{BACKEND_PORT}{endpoint}"

    cmd = ["curl", "-sk", "-X", method, url]

    if api_token:
        cmd.extend(["-H", f"Authorization: Bearer {api_token}"])

    cmd.extend(["-H", "Content-Type: application/json"])

    if body:
        cmd.extend(["-d", body])

    result = run_command(cmd, timeout=30)

    # Try to pretty-print JSON
    try:
        parsed = json.loads(result)
        return json.dumps(parsed, indent=2)
    except (json.JSONDecodeError, ValueError):
        return result


@mcp.tool()
def fleet_setup(
    email: str = "admin@example.com",
    password: str = "password123#",
    org_name: str = "Fleet Dev",
) -> str:
    """Run initial Fleet setup to create admin user.

    Args:
        email: Admin email address
        password: Admin password (min 12 chars with special char)
        org_name: Organization name
    """
    setup_body = json.dumps({
        "server_url": f"https://localhost:{BACKEND_PORT}",
        "org_info": {"org_name": org_name},
        "admin": {
            "admin": True,
            "email": email,
            "name": "Admin",
            "password": password,
            "password_confirmation": password,
        },
    })

    return call_fleet_api("/api/v1/setup", method="POST", body=setup_body)


# =============================================================================
# Database Tools
# =============================================================================


@mcp.tool()
def query_database(query: str) -> str:
    """Execute a read-only SQL query against the Fleet MySQL database.

    Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed.

    Args:
        query: SQL query to execute (must be read-only)
    """
    # Safety check - only allow read operations
    normalized = query.strip().upper()
    allowed_prefixes = ("SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN")
    if not any(normalized.startswith(prefix) for prefix in allowed_prefixes):
        return "Only read-only queries are allowed (SELECT, SHOW, DESCRIBE, EXPLAIN)"

    return mysql_query(query)


@mcp.tool()
def list_tables() -> str:
    """List all tables in the Fleet database."""
    return mysql_query("SHOW TABLES;")


@mcp.tool()
def describe_table(table_name: str) -> str:
    """Show the schema/columns of a database table.

    Args:
        table_name: Name of the table to describe
    """
    # Basic SQL injection protection
    if not table_name.replace("_", "").isalnum():
        return "Invalid table name"
    return mysql_query(f"DESCRIBE `{table_name}`;")


@mcp.tool()
def get_table_row_counts() -> str:
    """Get row counts for all tables in the Fleet database.

    Useful for understanding which tables have data.
    """
    return mysql_query(
        "SELECT table_name, table_rows FROM information_schema.tables "
        "WHERE table_schema = 'fleet' ORDER BY table_rows DESC LIMIT 50;",
        use_root=True,
    )


# =============================================================================
# Build & Test Tools
# =============================================================================


@mcp.tool()
def run_js_tests(test_pattern: str | None = None) -> str:
    """Run JavaScript/frontend tests.

    Args:
        test_pattern: Optional test file or pattern to match
    """
    cmd = ["yarn", "--ignore-engines", "test"]
    if test_pattern:
        cmd.extend(["--", f"--testPathPattern={test_pattern}"])

    return run_command(cmd, timeout=120)


@mcp.tool()
def run_js_lint() -> str:
    """Run ESLint on the frontend code."""
    return run_command(["yarn", "--ignore-engines", "lint"], timeout=60)


@mcp.tool()
def run_go_tests(package: str, test_name: str | None = None) -> str:
    """Run Go tests for a specific package.

    Args:
        package: Go package path relative to project root, e.g. "server/service"
        test_name: Optional specific test name to run
    """
    cmd = [
        "go", "test",
        "-tags", "full,fts5,netgo",
        "-v",
        f"./{package}/...",
    ]
    if test_name:
        cmd.extend(["-run", test_name])

    env = {
        **os.environ,
        "MYSQL_TEST": "1",
        "REDIS_TEST": "1",
    }

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
            cwd=str(PROJECT_ROOT),
            env=env,
        )
        output = result.stdout
        if result.stderr:
            output += "\n" + result.stderr
        return output[-3000:] if len(output) > 3000 else output
    except subprocess.TimeoutExpired:
        return "Tests timed out after 5 minutes"
    except Exception as e:
        return f"Error: {e}"


# =============================================================================
# Entry Point
# =============================================================================


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fleet MCP Dev Server")
    parser.add_argument(
        "--service",
        choices=["backend", "frontend", "all"],
        default="all",
        help="Which service logs to focus on",
    )
    args = parser.parse_args()

    mcp.run(transport="stdio")
