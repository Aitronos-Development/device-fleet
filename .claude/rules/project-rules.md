# Project Rules

## Quick Commands
- Start dev: `./start-dev.sh`
- Build: `make fleet`
- Lint: `make lint`
- Test: `make test`
- JS test: `yarn test`
- Format check: `yarn prettier:check`

## Pre-Push Checklist
1. `make lint` passes
2. `yarn test` passes
3. No console.log or debug statements left in code
4. TypeScript types are correct (no `any` unless justified)

## Code Quality
- Follow existing code patterns in the file you're editing
- Don't introduce new dependencies without justification
- Keep changes minimal and focused
- Test your changes where test infrastructure exists
