# Repository Guidelines

## Project Structure & Module Organization
- `src/app/`: Next.js App Router UI. Key areas include `_components/`, `_hooks/`, `_lib/`, and routes under `api/`, `health/`, and `share/`.
- `src/services/`: Domain logic (agent loop, project/team logic, git provider auth).
- `src/tools/`: Claude tool implementations used by the agent.
- `src/lib/`: Shared clients (for example Supabase).
- `public/`: Static assets.
- `supabase/migrations/`: Database migrations.
- `supabase/migrations/020_project_jobs.sql`: Job queue schema for background clone/sync.
- `scripts/`: Utility scripts (for example `migrate.cjs`).
- `workspaces/`: Cloned repositories (set by `WORKSPACE_ROOT`).

## Build, Test, and Development Commands
- `npm run dev`: Run migrations then start Next.js dev server on port 3010.
- `npm run build`: Build for production.
- `npm run start`: Start the production server on port 3010.
- `npm run lint`: Run ESLint.
- `npm run typecheck`: TypeScript type checking.
- `npm run migrate`: Run database migrations manually.
- `npm run worker`: Run the background job worker for project clone/sync.

## Coding Style & Naming Conventions
- TypeScript/TSX with 2-space indentation, single quotes, and no semicolons (match existing files).
- React components use PascalCase and live in `src/app/_components/`.
- Hooks are named `useX` and live in `src/app/_hooks/`.
- API routes live at `src/app/api/<route>/route.ts`.
- Keep UI in `src/app/`, business logic in `src/services/`, and infra clients in `src/lib/`.

## Testing Guidelines
- No test runner is configured yet (no `jest`/`vitest` script). For now, run `npm run lint` and `npm run typecheck` before pushing.
- If adding tests, use `*.test.ts`/`*.test.tsx` under `src/` and add a test script to `package.json`.

## Commit & Pull Request Guidelines
- Commit messages follow conventional prefixes like `feat:`, `fix:`, `refactor:`, `docs:`, `debug:`.
- PRs should include: a short summary, steps to verify, and screenshots for UI changes.
- If you add migrations or env vars, include them in `supabase/migrations/` and document updates to `.env.example`.

## Security & Configuration
- Copy `.env.example` to `.env` and set required Anthropic and Supabase keys.
- Do not commit secrets or generated credentials.
