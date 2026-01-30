# AskCode

> **Looking for maintainers!** Interested in helping maintain this project? Open an issue or reach out.

AI-powered codebase Q&A. Ask questions about any Git repository in plain language.

**[Try it free → askcode.xgenie.co](https://askcode.xgenie.co)**

## What is AskCode?

AskCode lets you have conversations with codebases. Point it at a Git repository and ask questions like:

- "How does the authentication flow work?"
- "Where is the database schema defined?"
- "What does this function do?"
- "How do I add a new API endpoint?"

Under the hood, AskCode uses Claude with an agentic loop to explore the codebase - reading files, searching for patterns, and understanding code structure - before answering your questions.

## Features

- **Git Integration** - Clone any public or private repository (GitHub, GitLab, Gitea, Bitbucket)
- **AI-Powered Q&A** - Claude analyzes code structure and answers questions in plain language
- **Team Collaboration** - Invite team members with different access levels
- **Access Control** - Three tiers: Full (developers), Internal (product), External (support)
- **Conversation History** - Save and share conversations
- **Multi-Repo Projects** - Combine multiple repositories into one project
- **Self-Hostable** - Run on your own infrastructure

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (via Supabase)
- Anthropic API key

### Installation

```bash
# Clone the repository
git clone https://github.com/xGenieLabs/askcode.git
cd askcode

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations and start dev server
npm run dev
```

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...        # Your Anthropic API key
SUPABASE_URL=https://...            # Supabase project URL
SUPABASE_ANON_KEY=eyJ...            # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # Supabase service role key

# Optional
PORT=3010                           # Server port (default: 3010)
WORKSPACE_ROOT=./workspaces         # Where to clone repos
DATABASE_URL=postgresql://...       # Direct database connection
```

### Database Setup

AskCode uses Supabase for authentication and database. You can:

1. **Use Supabase Cloud** - Create a project at [supabase.com](https://supabase.com)
2. **Self-host Supabase** - Run Supabase locally with Docker

Migrations are in `supabase/migrations/` and run automatically on `npm run dev`.

## Architecture

```
src/
├── app/
│   ├── api/              # Next.js API routes
│   │   ├── ask/          # Q&A endpoints
│   │   ├── auth/         # Authentication
│   │   ├── projects/     # Project management
│   │   ├── teams/        # Team management
│   │   └── git-providers/# Git platform OAuth
│   └── health/           # Health check
├── services/
│   ├── agent.ts          # Claude agentic loop
│   ├── project.ts        # Git operations
│   ├── team.ts           # Team logic
│   └── git-provider.ts   # Git platform auth
├── tools/                # Claude tools (read_file, grep, etc.)
└── lib/                  # Supabase client
```

### How It Works

1. User adds a Git repository to a project
2. AskCode clones the repository to a workspace
3. User asks a question about the codebase
4. Claude enters an agentic loop:
   - Decides which files to read
   - Searches for relevant code
   - Explores the codebase structure
   - Formulates an answer
5. Answer is returned to the user

### Access Levels

Team members have tiered access that controls what information Claude reveals:

| Level | Role | What Claude Reveals |
|-------|------|---------------------|
| 100 | Full/Developer | Everything - code, APIs, third-party integrations |
| 60 | Internal/Product | Business logic, data flows, no third-party names |
| 30 | External/Support | User-facing features only, no internal details |

## Commands

```bash
npm run dev      # Run migrations + start dev server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
npm run typecheck# TypeScript type check
npm run migrate  # Run migrations manually
```

## Deployment

AskCode can be deployed anywhere that runs Node.js:

- **Dokploy/Coolify** - Use Nixpacks (auto-detected)
- **Docker** - Build with `docker build -t askcode .`
- **Vercel/Railway** - Connect your repo

Make sure to:
1. Set all required environment variables
2. Have a Supabase instance (cloud or self-hosted)
3. Configure Git provider OAuth if using private repos

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Contributing

Contributions are welcome!

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/lawzlo/xgenie-askcode.git
cd xgenie-askcode
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### Code Style

- Use TypeScript
- Follow existing patterns in the codebase
- Run `npm run lint` and `npm run typecheck` before committing

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [GitHub](https://github.com/lawzlo/xgenie-askcode)
- [Issues](https://github.com/lawzlo/xgenie-askcode/issues)
- [Discussions](https://github.com/lawzlo/xgenie-askcode/discussions)
