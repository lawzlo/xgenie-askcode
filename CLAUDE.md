# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AskCode is an AI-powered codebase Q&A API for non-developers. It clones git repositories, then uses Claude with an agentic loop to answer questions about the codebase in plain language.

## Commands

```bash
npm run dev      # Run migrations + start dev server (port 3010)
npm run worker   # Run background job worker (clone/sync repos) - required for project creation
npm run build    # Build Next.js app
npm start        # Run Next.js production server
npm run lint     # ESLint (Next.js config)
npm run typecheck # TypeScript type check
npm run migrate  # Run database migrations manually
```

For local development, run both `npm run dev` and `npm run worker` in separate terminals.

## Architecture

```
src/
├── app/
│   ├── _components/      # React client components (Header, ProjectList, AuthModal, etc.)
│   ├── _lib/             # Client-side utilities (fetch helpers, Supabase client)
│   ├── health/route.ts   # GET /health
│   └── api/              # Next.js Route Handlers (API)
│       ├── ask/           # /api/ask/* - Q&A with SSE streaming
│       ├── auth/          # /api/auth/*
│       ├── projects/      # /api/projects/*
│       ├── teams/         # /api/teams/*
│       └── git-providers/ # /api/git-providers/*
├── server/
│   ├── api.ts            # Request/auth helpers + CORS responses
│   └── worker.ts         # Background job processor (clone/sync)
├── types.ts              # TypeScript interfaces
├── services/
│   ├── agent.ts          # Claude agentic loop orchestration
│   ├── project.ts        # Git clone/sync + workspace management
│   ├── team.ts           # Team membership logic
│   ├── git-provider.ts   # Git platform authentication (GitHub, Gitea, etc.)
│   └── audit.ts          # Audit logging for team activity
├── tools/index.ts        # Claude tools: read_file, list_directory, search_files, grep
└── lib/supabase.ts       # Supabase client initialization
```

**Two-Service Architecture**: The app server handles HTTP requests, while a separate worker process handles git clone/sync jobs. Both must access the same `workspaces/` directory.

## Key Patterns

**Agentic Loop**: The AI agent in `services/agent.ts` runs Claude (claude-opus-4-5-20251101) in a loop until `stop_reason !== 'tool_use'`. Claude can call tools (read_file, grep, etc.) to explore the codebase before answering.

**Access Levels**: Team members have tiered access controlling what information Claude reveals:
- `100` (Full/Developer): Technical details, code structure, API endpoints
- `60` (Internal/Product): Business logic, data flows, no third-party names
- `30` (External/Support): User-facing features only, no internal details

Owners always have level 100. Access level is checked in `getUserAccessLevel()` and determines which system prompt Claude uses.

**Team-Based Access**: All resources (projects, git providers) belong to teams. Protected routes require:
- `Authorization: Bearer <token>` header (JWT from Supabase)
- `X-Team-Id: <uuid>` header to specify which team context

**RLS Enforcement**: PostgreSQL Row-Level Security policies ensure users only access teams they own or are members of. The service role client bypasses RLS for backend operations.

**Path Security**: Tools in `tools/index.ts` validate paths with `securePath()` to prevent directory traversal outside the workspace.

**Multi-Repo Projects**: A single project can contain multiple git repositories cloned to subdirectories under `workspaces/<teamId>_<timestamp>/`.

**Streaming Responses**: Q&A uses Server-Sent Events (SSE) via `askQuestionStream()` generator. Events include `status` (progress), `step_complete` (tool finished), and `complete` (final response).

**Job Queue**: Git operations (clone/sync) are queued in `project_jobs` table and processed by the worker. Jobs have retry logic with exponential backoff.

## Database

Uses Supabase (PostgreSQL). Migrations in `supabase/migrations/` run automatically on dev startup.

Key tables: `projects`, `conversations`, `teams`, `team_members`, `team_invites`, `git_providers`, `audit_logs`, `shared_conversations`, `project_jobs`

## Environment Variables

Required: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
Optional: `PORT` (default 3010), `WORKSPACE_ROOT`, `DATABASE_URL`
