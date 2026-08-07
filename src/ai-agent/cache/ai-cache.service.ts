import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AiAccessContext } from '../types/ai-access-context.type';
import type { AiChatMessage } from '../types/chat-message.type';
import { AiRedisService } from './ai-redis.service';

export const AI_CACHE_KEY_PREFIXES = {
  session: 'ai:session:',
  chatResult: 'ai:chat_cache:',
  model: 'ai:llm_cache:',
  taskState: 'ai:task_state:',
} as const;

export type AiTaskState = {
  checkpoint: Record<string, unknown>;
  metadata: Record<string, unknown>;
  pendingWrites: unknown[];
  updatedAt: string;
};

@Injectable()
export class AiCacheService {
  private readonly sessionTtlSeconds: number;
  private readonly defaultChatTtlSeconds: number;
  private readonly taskStateTtlSeconds: number;

  constructor(
    private readonly redisService: AiRedisService,
    private readonly configService: ConfigService,
  ) {
    this.sessionTtlSeconds = this.readPositiveNumber(
      'AI_SESSION_CACHE_TTL_SECONDS',
      7200,
    );
    this.defaultChatTtlSeconds = this.readPositiveNumber(
      'AI_CHAT_CACHE_TTL_SECONDS',
      600,
    );
    this.taskStateTtlSeconds = this.readPositiveNumber(
      'AI_TASK_STATE_TTL_SECONDS',
      86400,
    );
  }

  async getSessionContext(
    context: AiAccessContext,
    sessionId: string,
    databaseFallback: () => Promise<AiChatMessage[]> | AiChatMessage[],
  ): Promise<AiChatMessage[]> {
    const key = this.sessionKey(context, sessionId);
    const cached = await this.redisService.getJson<AiChatMessage[]>(key);

    if (cached) {
      return cached;
    }

    const restored = this.limitSessionMessages(await databaseFallback());
    await this.redisService.setJson(key, restored, this.sessionTtlSeconds);
    return restored;
  }

  async appendSessionMessages(
    context: AiAccessContext,
    sessionId: string,
    messages: AiChatMessage[],
    databaseFallback: () => Promise<AiChatMessage[]> | AiChatMessage[],
  ): Promise<AiChatMessage[]> {
    const current = await this.getSessionContext(
      context,
      sessionId,
      databaseFallback,
    );
    const updated = this.limitSessionMessages([...current, ...messages]);

    await this.redisService.setJson(
      this.sessionKey(context, sessionId),
      updated,
      this.sessionTtlSeconds,
    );

    return updated;
  }

  clearSession(context: AiAccessContext, sessionId: string): Promise<void> {
    return this.redisService.delete(this.sessionKey(context, sessionId));
  }

  async getChatResult(
    context: AiAccessContext,
    query: string,
    businessDimension = 'default',
  ): Promise<AiChatMessage | null> {
    const policy = this.chatPolicy(businessDimension);

    if (!policy.enabled) {
      return null;
    }

    return this.redisService.getJson<AiChatMessage>(
      this.chatResultKey(context, businessDimension, query),
    );
  }

  async setChatResult(
    context: AiAccessContext,
    query: string,
    message: AiChatMessage,
    businessDimension = 'default',
  ): Promise<void> {
    const policy = this.chatPolicy(businessDimension);

    if (!policy.enabled) {
      return;
    }

    const key = this.chatResultKey(context, businessDimension, query);
    const indexKey = this.chatResultIndexKey(
      context.tenantId,
      businessDimension,
    );

    await this.redisService.setJson(key, message, policy.ttlSeconds);
    await this.redisService.addToSet(
      indexKey,
      key,
      Math.max(policy.ttlSeconds, this.defaultChatTtlSeconds) + 60,
    );
  }

  async invalidateChatResults(
    tenantId: string,
    businessDimension: string,
  ): Promise<number> {
    const indexKey = this.chatResultIndexKey(tenantId, businessDimension);
    const keys = await this.redisService.getSetMembers(indexKey);

    await this.redisService.deleteMany(keys);
    await this.redisService.delete(indexKey);
    return keys.length;
  }

  getTaskState(
    context: AiAccessContext,
    taskId: string,
  ): Promise<AiTaskState | null> {
    return this.redisService.getJson<AiTaskState>(
      this.taskStateKey(context, taskId),
    );
  }

  setTaskState(
    context: AiAccessContext,
    taskId: string,
    state: AiTaskState,
    ttlSeconds = this.taskStateTtlSeconds,
  ): Promise<void> {
    return this.redisService.setJson(
      this.taskStateKey(context, taskId),
      state,
      ttlSeconds,
    );
  }

  deleteTaskState(context: AiAccessContext, taskId: string): Promise<void> {
    return this.redisService.delete(this.taskStateKey(context, taskId));
  }

  buildModelCachePlaceholderKey(
    context: AiAccessContext,
    hash: string,
  ): string {
    return `${AI_CACHE_KEY_PREFIXES.model}${context.tenantId}:${context.userId}:${hash}`;
  }

  private sessionKey(context: AiAccessContext, sessionId: string): string {
    return `${AI_CACHE_KEY_PREFIXES.session}${context.tenantId}:${context.userId}:${sessionId}`;
  }

  private chatResultKey(
    context: AiAccessContext,
    businessDimension: string,
    query: string,
  ): string {
    const queryHash = createHash('sha256')
      .update(query.trim().replace(/\s+/g, ' ').toLowerCase())
      .digest('hex');

    return `${AI_CACHE_KEY_PREFIXES.chatResult}${context.tenantId}:${this.normalizeDimension(businessDimension)}:${context.userId}:${queryHash}`;
  }

  private chatResultIndexKey(
    tenantId: string,
    businessDimension: string,
  ): string {
    return `${AI_CACHE_KEY_PREFIXES.chatResult}index:${tenantId}:${this.normalizeDimension(businessDimension)}`;
  }

  private taskStateKey(context: AiAccessContext, taskId: string): string {
    return `${AI_CACHE_KEY_PREFIXES.taskState}${context.tenantId}:${context.userId}:${taskId}`;
  }

  private limitSessionMessages(messages: AiChatMessage[]): AiChatMessage[] {
    return messages.slice(-20);
  }

  private chatPolicy(businessDimension: string): {
    enabled: boolean;
    ttlSeconds: number;
  } {
    const enabled =
      this.configService.get<string>('AI_CHAT_CACHE_ENABLED', 'true') !==
      'false';
    const overrides = this.readDimensionTtlOverrides();
    const ttlSeconds =
      overrides[this.normalizeDimension(businessDimension)] ??
      this.defaultChatTtlSeconds;

    return { enabled: enabled && ttlSeconds > 0, ttlSeconds };
  }

  private readDimensionTtlOverrides(): Record<string, number> {
    const raw = this.configService.get<string>(
      'AI_CHAT_CACHE_DIMENSION_TTLS',
      '{}',
    );

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed)
          .map(([key, value]) => [this.normalizeDimension(key), Number(value)])
          .filter((entry): entry is [string, number] =>
            Number.isFinite(entry[1]),
          ),
      );
    } catch {
      return {};
    }
  }

  private readPositiveNumber(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private normalizeDimension(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    return normalized.slice(0, 64) || 'default';
  }
}
