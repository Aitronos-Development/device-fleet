# Fleet Device Management - AI Development Guide

## Quick Start

```bash
./start-dev.sh              # Full dev environment (Docker + backend + frontend watcher)
./start-dev.sh backend      # Backend only
./start-dev.sh frontend     # Frontend watcher only
./start-dev.sh status       # Show status
./start-dev.sh stop         # Stop everything
```

## Essential Commands

| Task | Command |
|------|---------|
| Full dev start | `./start-dev.sh` |
| Build fleet binary | `make fleet` |
| Build with race detection | `make fleet-dev` |
| Install JS deps | `yarn` |
| Generate frontend assets | `make generate-dev` |
| Run all linters | `make lint` |
| Lint Go only | `make lint-go` |
| Lint JS only | `make lint-js` (or `yarn lint`) |
| Run all tests | `make test` |
| Run JS tests | `yarn test` |
| Run Go tests (specific pkg) | `MYSQL_TEST=1 REDIS_TEST=1 go test -tags full,fts5,netgo -v ./server/service/...` |
| Reset database | `./start-dev.sh db-reset` |
| Prepare DB | `./build/fleet prepare db --dev` |
| Storybook | `yarn storybook` |

## Architecture Overview

- **Backend**: Go (REST API server) → `./cmd/fleet/`, `./server/`
- **Frontend**: React 18 + TypeScript (SPA) → `./frontend/`
- **CLI tool**: `fleetctl` → `./cmd/fleetctl/`
- **Agent**: Orbit → `./orbit/`
- **Database**: MySQL 8.0 (port 9306)
- **Cache**: Redis 6 (port 9379)
- **Default server**: https://localhost:9080 (self-signed cert in dev)

## Project Structure

```
cmd/fleet/          # Fleet server entry point
cmd/fleetctl/       # CLI client entry point
server/             # Backend Go packages
  ├── service/      # Business logic & API handlers
  ├── datastore/    # Database layer (MySQL)
  ├── fleet/        # Core types and interfaces
  └── bindata/      # Embedded frontend assets
frontend/           # React SPA
  ├── components/   # React components (91 dirs)
  ├── pages/        # Page-level components
  ├── services/     # API service functions
  ├── hooks/        # Custom React hooks
  ├── interfaces/   # TypeScript interfaces
  ├── router/       # React Router config
  ├── context/      # React Context
  ├── styles/       # Global SCSS styles
  └── test/         # Test config, mocks, MSW handlers
ee/                 # Enterprise edition code
orbit/              # Fleet agent (Orbit)
assets/             # Built webpack bundles
```

## Code Conventions

### Go Backend
- Use `go test -tags full,fts5,netgo` for testing
- Environment variables for test infrastructure: `MYSQL_TEST=1 REDIS_TEST=1`
- Lint with `golangci-lint` (config: `.golangci.yml`)
- Build flags: `-tags full,fts5,netgo`

### React Frontend
- TypeScript with strict mode
- ESLint (Airbnb config) + Prettier for formatting
- SCSS modules for component styling
- React Testing Library + MSW for tests
- Jest config: `frontend/test/jest.config.js`
- Component pattern: `frontend/components/<ComponentName>/`
- Each component dir typically contains: `ComponentName.tsx`, `ComponentName.tests.tsx`, `_styles.scss`

### Testing
- **Go tests**: `make run-go-tests PKG_TO_TEST="server/service"`
- **JS tests**: `yarn test` or `yarn test --watch`
- **E2E setup**: `make e2e-reset-db && make e2e-setup`

## Docker Services

The `docker-compose.yml` provides:
- **mysql** (port 9306) - Primary dev database (root/toor, fleet/insecure)
- **mysql_test** (port 3307) - Test database
- **redis** (port 9379) - Cache/sessions
- **mailhog** (port 8025/1025) - Email testing UI
- **saml_idp** (port 9080) - SAML identity provider testing
- **localstack** (port 4566) - AWS service simulation

## Dev Logs

When using `./start-dev.sh`, logs are written to:
- `.dev-logs/backend.log` - Fleet server output
- `.dev-logs/frontend.log` - Webpack watcher output
- `.dev-logs/docker.log` - Docker compose output

## Database

- **Connection**: `mysql -h localhost -P 9306 -u fleet -pinsecure fleet`
- **Root access**: `mysql -h localhost -P 9306 -u root -ptoor fleet`
- **Reset**: `./start-dev.sh db-reset`
- **Migrations**: `./build/fleet prepare db --dev`

## MCP Server (AI Tool Integration)

When `./start-dev.sh` runs, it auto-configures MCP (Model Context Protocol) for Claude Code and Cursor at `.claude/mcp.json` and `.cursor/mcp.json`.

The MCP dev server (`scripts/development/mcp_dev_server.py`) provides these tools:

### Log Tools
- `get_backend_logs(lines, offset)` - Read Fleet server logs
- `get_frontend_logs(lines, offset)` - Read webpack/frontend logs
- `get_docker_logs(lines, offset)` - Read Docker compose logs
- `tail_logs(service, lines)` - Tail any service logs

### Dev Commands
- `restart_backend()` - Restart the Fleet server
- `rebuild_and_restart()` - Full rebuild (webpack + bindata + Go build + restart)
- `reset_database()` - Drop and recreate database with migrations
- `get_current_status()` - Health check all services

### API Tools
- `call_fleet_api(endpoint, method, body, api_token)` - Call Fleet REST API
- `fleet_setup(email, password, org_name)` - Run initial Fleet setup

### Database Tools
- `query_database(query)` - Read-only SQL queries
- `list_tables()` - Show all tables
- `describe_table(table_name)` - Show table schema
- `get_table_row_counts()` - Row counts for all tables

### Build & Test Tools
- `run_js_tests(test_pattern)` - Run frontend tests
- `run_js_lint()` - Run ESLint
- `run_go_tests(package, test_name)` - Run Go tests

### Manual MCP Setup
If the auto-config doesn't work, copy `scripts/development/mcp.json.example` to `.claude/mcp.json` or `.cursor/mcp.json`.
