# Repository Guidelines

## Project Structure & Modules
- Root React/Vite app entry: `index.html`, `index.tsx`, `App.tsx`.
- UI components live in `components/` (e.g. `components/SlideRenderer.tsx`).
- Domain and integration logic lives in `services/` (e.g. `services/geminiService.ts`).
- Shared types and constants are in `types.ts` and `constants.ts`.

## Build, Test, and Development
- `npm install` — install dependencies.
- `npm run dev` — start the Vite dev server.
- `npm run build` — create a production build in `dist/`.
- `npm run preview` — serve the built app for local verification.
- No test scripts are currently defined; add them alongside new test files when needed.

## Coding Style & Naming
- Use TypeScript with ES modules and React function components.
- Prefer descriptive, PascalCase names for components (`SlideRenderer`) and camelCase for functions/variables (`handleUpload`).
- Keep files focused: UI in `components/`, logic in `services/`, shared config in root helper files.
- Match existing formatting (2-space indentation) and keep imports sorted logically (React, third-party, local).

## Testing Guidelines
- When adding tests, colocate them near the code under test (e.g. `components/SlideRenderer.test.tsx`).
- Use a standard React testing stack (e.g. Jest + React Testing Library) if introduced; mirror patterns consistently.
- Ensure new features include basic render and critical interaction coverage before merging.

## Commit & Pull Request Practices
- Write clear, imperative commit messages (e.g. `Add slide selection overlay`, `Fix image crop bounds`).
- Scope each PR to a focused change set with a concise summary, screenshots or GIFs for UI changes, and any relevant issue links.
- Call out breaking changes or new environment/configuration requirements in the PR description.

