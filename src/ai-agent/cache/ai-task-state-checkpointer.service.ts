import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { AiAccessContext } from '../types/ai-access-context.type';
import { AiCacheService, type AiTaskState } from './ai-cache.service';

export type LangGraphCheckpointConfig = {
  configurable?: {
    thread_id?: string;
    checkpoint_ns?: string;
    checkpoint_id?: string;
  };
};

export type LangGraphCheckpointTuple = {
  config: LangGraphCheckpointConfig;
  checkpoint: Record<string, unknown>;
  metadata: Record<string, unknown>;
  pendingWrites: unknown[];
};

/**
 * Lightweight checkpoint facade retained for AI task services that do not yet
 * depend on LangGraph's BaseCheckpointSaver. It stores the latest checkpoint
 * and pending writes in the same tenant/user-scoped cache namespace.
 */
@Injectable()
export class AiTaskStateCheckpointerService {
  constructor(private readonly cacheService: AiCacheService) {}

  async getTuple(
    context: AiAccessContext,
    config: LangGraphCheckpointConfig,
  ): Promise<LangGraphCheckpointTuple | undefined> {
    const threadId = this.requireThreadId(config);
    const state = await this.cacheService.getTaskState(context, threadId);

    if (!state || !this.isRecord(state.checkpoint)) {
      return undefined;
    }

    return {
      config,
      checkpoint: state.checkpoint,
      metadata: state.metadata,
      pendingWrites: state.pendingWrites,
    };
  }

  async put(
    context: AiAccessContext,
    config: LangGraphCheckpointConfig,
    checkpoint: Record<string, unknown>,
    metadata: Record<string, unknown> = {},
  ): Promise<LangGraphCheckpointConfig> {
    const threadId = this.requireThreadId(config);
    const checkpointId =
      config.configurable?.checkpoint_id ??
      (typeof checkpoint.id === 'string' ? checkpoint.id : randomUUID());
    const nextConfig: LangGraphCheckpointConfig = {
      configurable: {
        ...config.configurable,
        thread_id: threadId,
        checkpoint_id: checkpointId,
      },
    };
    const existing = await this.cacheService.getTaskState(context, threadId);

    await this.cacheService.setTaskState(context, threadId, {
      checkpoint,
      metadata,
      pendingWrites: existing?.pendingWrites ?? [],
      updatedAt: new Date().toISOString(),
    });

    return nextConfig;
  }

  async putWrites(
    context: AiAccessContext,
    config: LangGraphCheckpointConfig,
    writes: unknown[],
  ): Promise<void> {
    const threadId = this.requireThreadId(config);
    const existing =
      (await this.cacheService.getTaskState(context, threadId)) ??
      this.emptyState();

    await this.cacheService.setTaskState(context, threadId, {
      ...existing,
      pendingWrites: [...existing.pendingWrites, ...writes],
      updatedAt: new Date().toISOString(),
    });
  }

  async *list(
    context: AiAccessContext,
    config: LangGraphCheckpointConfig,
  ): AsyncGenerator<LangGraphCheckpointTuple> {
    const tuple = await this.getTuple(context, config);

    if (tuple) {
      yield tuple;
    }
  }

  deleteThread(context: AiAccessContext, threadId: string): Promise<void> {
    return this.cacheService.deleteTaskState(context, threadId);
  }

  private requireThreadId(config: LangGraphCheckpointConfig): string {
    const threadId = config.configurable?.thread_id?.trim();

    if (!threadId) {
      throw new Error('LangGraph checkpoint config requires thread_id');
    }

    return threadId;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private emptyState(): AiTaskState {
    return {
      checkpoint: {},
      metadata: {},
      pendingWrites: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

