# Testing Guide

## JavaScript / Frontend Tests
```bash
yarn test                                          # All JS tests
yarn test -- --watch                               # Watch mode
yarn test -- --testPathPattern="ComponentName"      # Specific test
yarn test -- --coverage                            # With coverage
yarn test:ci                                       # CI mode with coverage
```

- Framework: Jest 29 + React Testing Library + MSW
- Config: `frontend/test/jest.config.js`
- Setup: `frontend/test/test-setup.ts`
- Mock handlers: `frontend/test/handlers/`

## Go / Backend Tests
```bash
# Run tests for a specific package
make run-go-tests PKG_TO_TEST="server/service"

# Run a specific test
MYSQL_TEST=1 REDIS_TEST=1 go test -tags full,fts5,netgo -v -run TestSpecificName ./server/service/...

# Fast tests (no external deps)
go test -tags full,fts5,netgo ./server/fleet/...

# Debug a test with Delve
make debug-go-tests PKG_TO_TEST="server/service" TESTS_TO_RUN="TestName"
```

Required environment variables for integration tests:
- `MYSQL_TEST=1` - Enable MySQL tests
- `REDIS_TEST=1` - Enable Redis tests
- `S3_STORAGE_TEST=1` - Enable S3 tests
- `SAML_IDP_TEST=1` - Enable SAML tests

## E2E Tests
```bash
make e2e-reset-db          # Reset e2e database
make e2e-setup             # Set up e2e users/config
make e2e-serve-premium     # Start server for e2e (premium)
make e2e-serve-free        # Start server for e2e (free)
```

## Storybook
```bash
yarn storybook             # Dev server on port 6006
yarn build-storybook       # Build static storybook
```
