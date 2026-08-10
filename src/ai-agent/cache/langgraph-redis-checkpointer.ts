import { Injectable } from '@nestjs/common';
import type { RunnableConfig } from '@langchain/core/runnables';
import {
  BaseCheckpointSaver,
  type ChannelVersions,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointPendingWrite,
  type CheckpointTuple,
  type PendingWrite,
} from '@langchain/langgraph-checkpoint';

import type { AiAccessContext } from '../types/ai-access-context.type';
import { AiCacheService } from './ai-cache.service';

/**
 * A request-scoped LangGraph checkpointer backed by the AI module cache.
 *
 * Tenant and user identifiers are bound by the factory from the verified JWT
 * context. They never come from RunnableConfig, preventing callers from
 * selecting another user's Redis namespace.
 */
export class LangGraphRedisCheckpointer extends BaseCheckpointSaver {
  constructor(
    private readonly cacheService: AiCacheService,
    private readonly accessContext: AiAccessContext,
  ) {
    super();
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = this.requireThreadId(config);
    const state = await this.cacheService.getTaskState(
      this.accessContext,
      threadId,
    );

    if (!state || !this.isCheckpoint(state.checkpoint)) {
      return undefined;
    }

    return {
      config: this.checkpointConfig(config, threadId, state.checkpoint.id),
      checkpoint: state.checkpoint,
      metadata: state.metadata as CheckpointMetadata,
      pendingWrites: state.pendingWrites as CheckpointPendingWrite[],
    };
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    if (options?.limit === 0) {
      return;
    }

    const tuple = await this.getTuple(config);

    if (tuple) {
      yield tuple;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const threadId = this.requireThreadId(config);
    const existing = await this.cacheService.getTaskState(
      this.accessContext,
      threadId,
    );

    await this.cacheService.setTaskState(this.accessContext, threadId, {
      checkpoint,
      metadata,
      pendingWrites: existing?.pendingWrites ?? [],
      updatedAt: new Date().toISOString(),
    });

    return this.checkpointConfig(config, threadId, checkpoint.id);
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    const threadId = this.requireThreadId(config);
    const existing = await this.cacheService.getTaskState(
      this.accessContext,
      threadId,
    );

    if (!existing) {
      throw new Error(
        'A checkpoint must be stored before pending writes are appended',
      );
    }

    const pendingWrites: CheckpointPendingWrite[] = writes.map(
      ([channel, value]) => [taskId, channel, value],
    );

    await this.cacheService.setTaskState(this.accessContext, threadId, {
      ...existing,
      pendingWrites: [...existing.pendingWrites, ...pendingWrites],
      updatedAt: new Date().toISOString(),
    });
  }

  deleteThread(threadId: string): Promise<void> {
    const normalized = threadId.trim();

    if (!normalized) {
      throw new Error('LangGraph thread_id is required');
    }

    return this.cacheService.deleteTaskState(this.accessContext, normalized);
  }

  private checkpointConfig(
    config: RunnableConfig,
    threadId: string,
    checkpointId: string,
  ): RunnableConfig {
    return {
      ...config,
      configurable: {
        ...config.configurable,
        thread_id: threadId,
        checkpoint_ns: this.checkpointNamespace(config),
        checkpoint_id: checkpointId,
      },
    };
  }

  private requireThreadId(config: RunnableConfig): string {
    const value = config.configurable?.thread_id;

    if (typeof value !== 'string' || !value.trim()) {
      throw new Error('LangGraph checkpoint config requires thread_id');
    }

    return value.trim();
  }

  private checkpointNamespace(config: RunnableConfig): string {
    const value = config.configurable?.checkpoint_ns;
    return typeof value === 'string' ? value : '';
  }

  private isCheckpoint(value: unknown): value is Checkpoint {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
      typeof candidate.id === 'string' &&
      typeof candidate.v === 'number' &&
      typeof candidate.ts === 'string' &&
      typeof candidate.channel_values === 'object' &&
      candidate.channel_values !== null &&
      typeof candidate.channel_versions === 'object' &&
      candidate.channel_versions !== null &&
      typeof candidate.versions_seen === 'object' &&
      candidate.versions_seen !== null
    );
  }
}

@Injectable()
export class LangGraphCheckpointerFactory {
  constructor(private readonly cacheService: AiCacheService) {}

  create(context: AiAccessContext): LangGraphRedisCheckpointer {
    return new LangGraphRedisCheckpointer(this.cacheService, context);
  }
}
