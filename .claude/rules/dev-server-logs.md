# Dev Server & Logs

## Starting the Dev Server
```bash
./start-dev.sh              # Full stack (Docker + backend + frontend watcher)
./start-dev.sh backend      # Backend only (with Docker services)
./start-dev.sh frontend     # Frontend watcher only
```

## Interactive Commands (while server is running)
- `s` = Show status and connection info
- `r` = Restart backend server
- `b` = Full rebuild (binary + assets)
- `l` = Tail backend logs
- `d` = Reset database
- `h` = Help
- `q` = Quit

## Log Locations
- Backend: `.dev-logs/backend.log`
- Frontend: `.dev-logs/frontend.log`
- Docker: `.dev-logs/docker.log`

## Accessing Logs
```bash
tail -f .dev-logs/backend.log     # Live backend logs
tail -f .dev-logs/frontend.log    # Live frontend/webpack logs
./start-dev.sh logs               # Shortcut for backend log tail
```

## Common Issues
- If port 9080 is in use: `lsof -ti:9080 | xargs kill -9`
- If MySQL won't start: `docker compose down -v && docker compose up -d mysql`
- If assets are stale: Press `b` to rebuild, or run `make generate-dev`

## Service Ports
| Service | Port |
|---------|------|
| Fleet Backend | 9080 |
| MySQL | 9306 |
| MySQL Test | 3307 |
| Redis | 9379 |
| Mailhog UI | 8025 |
| Storybook | 6006 |
