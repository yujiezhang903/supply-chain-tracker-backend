# AI Agent module

This module owns AI-specific persistence, authorization, model routing and
cache behavior. It calls existing business services for project data and does
not add fields to existing business tables.

## Code map

| Path | Responsibility |
| --- | --- |
| `adapters/` | Provider-neutral model interface and provider adapters |
| `auth/` | JWT validation, current-user context and administrator guard |
| `cache/` | Redis ownership, chat/session caching and LangGraph checkpoint state |
| `controllers/` | Authenticated CRUD and cache administration routes |
| `dto/` | Request validation and pagination inputs |
| `entities/` | The four AI-owned TypeORM entities |
| `services/` | Tenant-scoped CRUD, audit recording and access helpers |
| `ai-agent.service.ts` | One-turn chat orchestration and structured responses |

## Data model

| Table | Purpose | Important constraints and indexes |
| --- | --- | --- |
| `ai_chat_session` | Persisted sessions and messages | User FK; tenant/user/update and tenant/status indexes; status check |
| `ai_user_memory` | Long-term user memory | User FK; unique tenant/user/key; importance check; expiry index |
| `ai_task_record` | Agent task records | User and optional session FKs; status/progress checks; tenant/user/status index |
| `ai_operation_audit` | AI operation audit log | Nullable user FK; tenant/user/time and tenant/action/time indexes; outcome check |

The tables are created by
`src/database/migrations/1786392000000-CreateAiAgentTables.ts`. Local
`synchronize` support is temporary; reviewed migrations are the deployment
source of truth.

## Request and authorization flow

1. `AiJwtAuthGuard` verifies the bearer token.
2. The guard reloads the user and rejects missing or inactive accounts.
3. It creates an `AiAccessContext` containing the verified user and tenant.
4. Controllers pass that context to services.
5. Every user-owned repository query includes both `tenantId` and `userId`.
6. Administrator audit queries can cross users only inside the current tenant.

Foreign IDs return the same 404 response as missing IDs. This prevents callers
from using response differences to discover another user's or tenant's data.

## Chat flow

`AiAgentService` coordinates one message without bypassing module boundaries:

1. Load or create the current user's session.
2. Restore recent context from Redis or the persisted session.
3. Persist the user message.
4. Return a deterministic table/chart for supported company-data questions, or
   route the request through the selected model adapter.
5. Cache eligible chat results.
6. Persist the assistant response and record an audit event.

Company data is loaded through `CompaniesService.findAll()`, not by querying
the company repository from the AI module.

## Redis ownership

`AiRedisService` is the only class that calls the Redis client. Higher layers
use `AiCacheService` and the following namespaces:

| Prefix | Content | Default expiry |
| --- | --- | --- |
| `ai:session:` | Latest 20 messages (10 turns) | 2 hours |
| `ai:chat_cache:` | Result for the same tenant, user, dimension and normalized query | 10 minutes |
| `ai:llm_cache:` | Reserved model-cache namespace | Not implemented |
| `ai:task_state:` | Current task/checkpoint state | 24 hours |

Chat cache keys contain a SHA-256 hash of the normalized query. A separate
per-tenant, per-dimension index supports targeted invalidation after business
data changes.

If Redis is unavailable, a process-local map keeps local development usable.
That fallback is intentionally limited: it is lost on restart and is not shared
between application instances.

## LangGraph compatibility

`LangGraphRedisCheckpointer` implements `BaseCheckpointSaver` and binds the
tenant/user namespace in its factory. Tenant identity never comes from
LangGraph's `RunnableConfig`.

The current Redis representation stores the latest checkpoint and pending
writes for a thread. Historical checkpoint traversal is outside this
milestone.

## Model providers

`AiModelRouterService` supports `deepseek`, `qwen`, `openai` and
`mock`. Provider adapters share the OpenAI-compatible HTTP transport where
possible. Use `mock` for local flow testing without external credentials.

## Routes

All routes require `Authorization: Bearer <JWT>`.

- `POST/GET /ai-agent/sessions`
- `GET/PATCH/DELETE /ai-agent/sessions/:id`
- `POST /ai-agent/sessions/:id/close`
- `POST/GET /ai-agent/memories`
- `GET/PATCH/DELETE /ai-agent/memories/:id`
- `POST/GET /ai-agent/tasks`
- `GET/PATCH/DELETE /ai-agent/tasks/:id`
- `POST/GET /ai-agent/audits`
- `GET/PATCH/DELETE /ai-agent/audits/:id`
- `POST /ai-agent/chat`

Cache status and invalidation routes are administrator-only.

## Validation

```bash
npm test -- ai-access-isolation.spec.ts --runInBand
npm test -- ai-cache.service.spec.ts --runInBand
npm run build
```

When changing cache TTLs or provider settings, update `.env.example` and this
guide in the same commit.
