# Backend Development (Go)

## Structure
- Entry point: `cmd/fleet/main.go`
- API handlers: `server/service/`
- Data layer: `server/datastore/mysql/`
- Core types: `server/fleet/`
- Enterprise features: `ee/server/`

## Build & Run
```bash
make fleet                    # Build binary
make fleet-dev                # Build with race detection
./build/fleet serve --dev     # Run server
./build/fleet prepare db --dev # Run migrations
```

## Testing
```bash
# Run specific package tests
make run-go-tests PKG_TO_TEST="server/service"

# Run specific test
MYSQL_TEST=1 REDIS_TEST=1 go test -tags full,fts5,netgo -v -run TestName ./server/service/...

# Always use these build tags
-tags full,fts5,netgo
```

## Conventions
- Use the existing error handling patterns in the codebase
- Database queries go in `server/datastore/mysql/`
- Business logic goes in `server/service/`
- API endpoint types defined in `server/fleet/`
- Use `ctxerr` package for error wrapping with context
