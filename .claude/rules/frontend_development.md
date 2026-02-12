# Frontend Development (React + TypeScript)

## Structure
- Components: `frontend/components/<ComponentName>/`
- Pages: `frontend/pages/`
- API services: `frontend/services/`
- Hooks: `frontend/hooks/`
- Types: `frontend/interfaces/`
- Router: `frontend/router/`
- Tests: alongside components or in `frontend/test/`

## Component Pattern
Each component directory typically contains:
- `ComponentName.tsx` - Main component
- `ComponentName.tests.tsx` - Tests
- `_styles.scss` - Component styles

## Key Libraries
- React 18 + React DOM 18
- TypeScript 4.7
- React Router 3.x (with hooks)
- React Query 3.x for data fetching
- React Table 7.x for data tables
- SCSS for styling (with Bourbon mixins)

## Testing
```bash
yarn test                     # Run all JS tests
yarn test -- --watch          # Watch mode
yarn test -- --testPathPattern="ComponentName"  # Specific component
```

- Uses Jest + React Testing Library + MSW (Mock Service Worker)
- Mock handlers: `frontend/test/handlers/`
- Test utilities: `frontend/test/`

## Styling
- Use SCSS modules (`.scss` files)
- Follow existing BEM-like naming patterns
- Global styles in `frontend/styles/`
- Bourbon mixins available via `node-bourbon`

## Code Quality
- ESLint with Airbnb config: `yarn lint`
- Prettier for formatting: `yarn prettier:check`
- TypeScript strict mode enabled
