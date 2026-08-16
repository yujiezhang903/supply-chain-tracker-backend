# Supply Chain Tracker Backend

NestJS API for the Supply Chain Tracker project. It provides authentication,
user and company management, relationship and order data, dashboard analytics,
and the AI Agent persistence/cache foundation.

The matching frontend is maintained in
[supply-chain-tracker-frontend](https://github.com/yujiezhang903/supply-chain-tracker-frontend).

## Main modules

| Module | Responsibility |
| --- | --- |
| `auth` and `users` | JWT authentication and user management |
| `companies` | Company records and filters |
| `relationships` | Supply-chain relationships between companies |
| `orders` | Order records |
| `dashboard` | Aggregated dashboard data |
| `ai-agent` | Chat sessions, user memory, tasks, audit logs, model routing and Redis caches |

AI code is isolated under `src/ai-agent`; it does not modify existing business
entities. See [the AI module guide](src/ai-agent/README.md) for its data model,
cache keys, authorization rules and routes.

## Technology

- Node.js 22 and TypeScript
- NestJS 11
- PostgreSQL and TypeORM
- Redis (with an in-process development fallback)
- Jest
- Swagger/OpenAPI

## Prerequisites

- Node.js 22+
- npm
- PostgreSQL
- Redis or Memurai for persistent AI cache behavior

Redis is optional for local development because the AI module can fall back to
process memory. The fallback is not shared across application instances and
must not be treated as production storage.

## Local setup

1. Install dependencies.

   ```bash
   npm install
   ```

2. Create the environment file.

   ```bash
   cp .env.example .env
   ```

3. Update the PostgreSQL credentials and `JWT_SECRET` in `.env`.

4. Apply database migrations.

   ```bash
   npm run migration:run
   ```

5. Start the API.

   ```bash
   npm run start:dev
   ```

The API listens on `http://localhost:3001`. Swagger documentation is available
at `http://localhost:3001/api`.

### Database synchronization

`DATABASE_SYNCHRONIZE=true` is retained only for the current local development
workflow. Use `DATABASE_SYNCHRONIZE=false` outside local development and apply
reviewed migrations instead. The AI tables are defined by
`1786392000000-CreateAiAgentTables.ts`.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run start:dev` | Start NestJS in watch mode |
| `npm run build` | Compile the project |
| `npm run lint` | Run ESLint and apply safe fixes |
| `npm run format` | Format TypeScript source and tests |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run migration:show` | Show migration status |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Revert the latest migration |
| `npm run import:company-data` | Import the company dataset |

## AI Agent verification

Run the focused tests after changing authorization, tenancy or caching:

```bash
npm test -- ai-access-isolation.spec.ts --runInBand
npm test -- ai-cache.service.spec.ts --runInBand
npm run build
```

The access-isolation suite verifies that users cannot query another user's AI
records and that administrators remain restricted to their own tenant.

## Configuration notes

- Never commit `.env` or real API keys.
- Use a strong `JWT_SECRET` outside local development.
- `AI_DEFAULT_TENANT_ID` is a compatibility fallback for older JWTs that do
  not yet contain a tenant claim.
- Start with `AI_MODEL_PROVIDER=mock` when validating the chat flow.
- Configure one provider's API key and model before selecting
  `deepseek`, `qwen` or `openai`.

## Repository hygiene

Generated output, local environment files, coverage, dependencies and temporary
backup files are ignored. Use Git history or a short-lived branch instead of
committing `.before-*`, `.backup.*` or ad-hoc repair copies.

