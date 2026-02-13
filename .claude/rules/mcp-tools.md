# MCP Tools

The Fleet MCP dev server provides tools for direct interaction with the dev environment.
These are available when running `./start-dev.sh` and configured in `.claude/mcp.json`.

## Available Tools

### Logs
Use MCP tools instead of reading log files directly:
- `get_backend_logs(lines=250)` - Fleet server logs
- `get_frontend_logs(lines=250)` - Webpack output
- `tail_logs(service="backend", lines=50)` - Quick tail

### Server Control
- `restart_backend()` - Quick restart without rebuild
- `rebuild_and_restart()` - Full rebuild cycle (webpack + bindata + Go + restart)
- `reset_database()` - Drop DB, recreate, run migrations

### Database Access
- `query_database("SELECT ...")` - Read-only SQL queries
- `list_tables()` - Quick table listing
- `describe_table("hosts")` - Table schema
- `get_table_row_counts()` - Data overview

### API Testing
- `call_fleet_api("/api/v1/fleet/hosts", "GET")` - Test endpoints
- `fleet_setup()` - Run initial setup (creates admin user)

### Testing
- `run_js_tests()` - Frontend tests
- `run_go_tests("server/service")` - Backend tests for specific package

## When to Use MCP vs Direct Commands
- **Use MCP** for: reading logs, checking status, quick DB queries, API testing
- **Use direct commands** for: complex multi-step workflows, interactive debugging, file editing
