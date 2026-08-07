# AI Agent data and cache foundation

This module owns all AI-specific persistence and does not change any existing
business table. Every AI row is scoped by `tenantId`; user-owned rows also
carry a `userId` foreign key to `users.id`.

## Tables

| Table | Purpose | Main constraints and indexes |
| --- | --- | --- |
| `ai_chat_session` | Persisted chat sessions and messages | User FK, tenant/user/update index, tenant/status index, status check |
| `ai_user_memory` | Long-term user memory entries | User FK, unique tenant/user/memory key, importance check, expiry index |
| `ai_task_record` | Agent task records | User and optional session FKs, status/progress checks, tenant/user/status index |
| `ai_operation_audit` | AI operation audit log | Nullable user FK, tenant/user/time and tenant/action/time indexes, outcome check |

The application currently uses TypeORM `synchronize: true` for local
development, so registered entities create these tables automatically. A
production deployment should replace synchronization with reviewed migrations.

## Authorization and tenant isolation

All `/ai-agent/**` endpoints require `Authorization: Bearer <JWT>`. The guard
loads the current user from the existing `users` table. `tenantId` comes from
the signed JWT, with `AI_DEFAULT_TENANT_ID` as a compatibility fallback for
tokens issued before tenant claims were added.

Every repository lookup includes `tenantId`. Session, memory and task queries
also include the current `userId`. A missing or foreign ID returns 404, so an
API caller cannot use record existence to probe another user or tenant.
Administrators may read all audit rows in their own tenant and optionally
filter them by `userId`; they never bypass tenant scope.

## CRUD routes

- `POST/GET /ai-agent/sessions`, `GET/PATCH/DELETE /ai-agent/sessions/:id`
- `POST /ai-agent/sessions/:id/close`
- `POST/GET /ai-agent/memories`, `GET/PATCH/DELETE /ai-agent/memories/:id`
- `POST/GET /ai-agent/tasks`, `GET/PATCH/DELETE /ai-agent/tasks/:id`
- `POST/GET /ai-agent/audits`, `GET/PATCH/DELETE /ai-agent/audits/:id`
- `POST /ai-agent/chat`

List routes accept `page`, `limit` and optional `userId`. Audit mutations and
cache invalidation are administrator-only.

## Redis ownership

`AiRedisService` is the only class allowed to call the Redis client. Higher
layers use `AiCacheService` and these prefixes:

- `ai:session:`: latest 20 messages (10 turns), default TTL 2 hours; DB fallback
- `ai:chat_cache:`: per-tenant, per-user, per-query result, default TTL 10 minutes
- `ai:llm_cache:`: reserved placeholder; model caching is not implemented
- `ai:task_state:`: expiring task/checkpoint state for future LangGraph work

`DELETE /ai-agent/cache/chat/:businessDimension` invalidates a tenant's cache
for updated business data. `AiTaskStateCheckpointerService` exposes
`getTuple`, `put`, `putWrites`, `list`, and `deleteThread` shapes compatible
with a later LangGraph Checkpointer adapter.

## Configuration

See `.env.example` for Redis URL, default tenant, cache TTLs, per-dimension
chat TTL overrides and task-state expiry. Redis connection failure uses a
process-local fallback for development; production should monitor
`GET /ai-agent/cache/status` and keep Redis available.

## Existing business services

The chat service injects `CompaniesService.findAll()` rather than directly
querying the `companies` table. This keeps AI access behind the project's
existing service boundary and leaves the business schema unchanged.
