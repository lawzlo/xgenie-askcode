# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AskCode is an AI-powered codebase Q&A API for non-developers. It clones git repositories, then uses Claude with an agentic loop to answer questions about the codebase in plain language. Built with Next.js 16 (standalone output) + Supabase + Anthropic SDK.

## Commands

```bash
npm run dev      # Run migrations + start dev server (port 3010)
npm run worker   # Run background job worker (clone/sync repos) - required for project creation
npm run build    # Build Next.js standalone app (copies static + public into .next/standalone/)
npm start        # Run production server (node .next/standalone/server.js)
npm run lint     # ESLint
npm run typecheck # TypeScript type check (tsc --noEmit)
npm run migrate  # Run database migrations manually (requires psql + DATABASE_URL)
```

For local development, run both `npm run dev` and `npm run worker` in separate terminals.

## Architecture

**Two-Service Architecture**: The Next.js app server handles HTTP requests + SSE streaming, while a separate worker process (`tsx src/server/worker.ts`) handles git clone/sync jobs. Both must access the same `workspaces/` directory.

### Key directories

- `src/app/api/` — Next.js Route Handlers (all use `runtime = 'nodejs'` + `dynamic = 'force-dynamic'`)
- `src/server/api.ts` — Auth helpers (`requireAuth`, `requireTeamId`), CORS, JSON response utilities
- `src/server/worker.ts` — Job queue poll loop with stale job recovery and exponential backoff
- `src/services/agent.ts` — Claude agentic loop (both sync `askQuestion` and streaming `askQuestionStream`)
- `src/services/project.ts` — Git clone/sync, workspace management, job enqueuing
- `src/services/team.ts` — Team membership + access level logic
- `src/services/git-provider.ts` — Git platform OAuth (GitHub App, Gitea, GitLab, Bitbucket)
- `src/tools/index.ts` — Sandboxed tools Claude uses: `read_file`, `list_directory`, `search_files`, `grep`
- `src/lib/supabase.ts` — Two Supabase clients: `supabase` (service role, bypasses RLS) and `supabaseAnon` (for auth)
- `scripts/migrate.cjs` — Runs SQL migrations via `psql`. Requires `DATABASE_URL` env var; gracefully skips if psql or DATABASE_URL absent.
- `supabase/migrations/` — Sequential SQL migrations (001-021), idempotent, run on dev startup

### Path alias

`@/*` maps to `./src/*` (configured in tsconfig.json).

## Key Patterns

**Agentic Loop**: `services/agent.ts` runs Claude (`claude-sonnet-4-6`) in a loop until `stop_reason !== 'tool_use'`. Claude calls sandboxed tools to explore the cloned workspace before answering. Both a non-streaming (`askQuestion`) and SSE streaming (`askQuestionStream`) variant exist.

**Access Levels**: Team members have tiered access controlling what information Claude reveals:
- `100` (Full/Developer): Technical details, code structure, API endpoints
- `60` (Internal/Product): Business logic, data flows, no third-party names
- `30` (External/Support): User-facing features only, no internal details

Owners always have level 100. Access level is checked in `getUserAccessLevel()` and selects one of three system prompts.

**Protected Route Pattern**: All API routes follow the same auth flow:
1. `requireAuth(request)` — validates `Authorization: Bearer <token>` via Supabase
2. `requireTeamId(request, userId)` — validates `X-Team-Id` header and checks team membership
3. Zod schema validation on request body
4. Returns via `jsonResponse()` (adds CORS headers)

**Path Security**: Tools in `tools/index.ts` validate all paths with `securePath()` — resolves paths and rejects anything outside the workspace root.

**Job Queue**: Git operations (clone/sync/add_repos) are enqueued in `project_jobs` table. The worker polls via `claim_project_job` RPC, with stale job detection (10min timeout) and retry with exponential backoff.

**SSE Streaming**: Q&A uses Server-Sent Events via `askQuestionStream()` async generator. Events: `status` (progress message), `step_complete` (tool finished), `complete` (final answer with follow-up suggestions).

**Multi-Repo Projects**: A single project can contain multiple git repositories. The `git_urls` JSON column stores `{ url, branch, name }[]`. Each repo is cloned to a subdirectory under `workspaces/<teamId>_<timestamp>/`.

**Follow-up Suggestions**: After answering, a separate Claude call generates 3 follow-up question suggestions. The `/api/projects/[id]/suggestions` endpoint also generates initial questions based on file structure.

## Database

Uses Supabase (PostgreSQL). Migrations in `supabase/migrations/` run automatically on `npm run dev` via `scripts/migrate.cjs` (needs `psql` in PATH).

Key tables: `projects`, `conversations`, `teams`, `team_members`, `team_invites`, `git_providers`, `audit_logs`, `shared_conversations`, `saved_conversations`, `project_jobs`

RLS is enabled on team-related tables. The service role client in `src/lib/supabase.ts` bypasses RLS for backend operations.

## Environment Variables

Required: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
Optional: `PORT` (default 3010), `WORKSPACE_ROOT` (default `./workspaces`), `DATABASE_URL` (for auto-migrations)
