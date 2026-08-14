import { ConfigService } from '@nestjs/config';

import type { AiAccessContext } from '../types/ai-access-context.type';
import type { AiChatMessage } from '../types/chat-message.type';
import { AiCacheService } from './ai-cache.service';
import { AiRedisService } from './ai-redis.service';
import { AiTaskStateCheckpointerService } from './ai-task-state-checkpointer.service';

describe('AI cache services', () => {
  const user: AiAccessContext = {
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-a',
    email: 'user@example.com',
    role: 'Viewer',
    isAdmin: false,
  };
  const otherUser: AiAccessContext = {
    ...user,
    userId: '22222222-2222-4222-8222-222222222222',
  };
  let redisService: AiRedisService;
  let cacheService: AiCacheService;

  beforeEach(async () => {
    const config = new ConfigService({
      AI_REDIS_ENABLED: 'false',
      AI_SESSION_CACHE_TTL_SECONDS: '7200',
      AI_CHAT_CACHE_TTL_SECONDS: '600',
      AI_TASK_STATE_TTL_SECONDS: '60',
    });
    redisService = new AiRedisService(config);
    await redisService.onModuleInit();
    cacheService = new AiCacheService(redisService, config);
  });

  it('keeps the latest ten conversation turns and restores once from DB', async () => {
    const messages = Array.from({ length: 24 }, (_, index) =>
      message(`message-${index}`),
    );
    const loader = jest.fn(() => messages);

    const first = await cacheService.getSessionContext(
      user,
      'session-1',
      loader,
    );
    const second = await cacheService.getSessionContext(
      user,
      'session-1',
      loader,
    );

    expect(first).toHaveLength(20);
    expect(first[0].content).toEqual({ type: 'text', text: 'message-4' });
    expect(second).toEqual(first);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('isolates chat results by user and invalidates one business dimension', async () => {
    const result = message('cached answer');

    await cacheService.setChatResult(
      user,
      'same question',
      result,
      'companies',
    );

    await expect(
      cacheService.getChatResult(user, 'same question', 'companies'),
    ).resolves.toEqual(result);
    await expect(
      cacheService.getChatResult(otherUser, 'same question', 'companies'),
    ).resolves.toBeNull();
    await expect(
      cacheService.invalidateChatResults('tenant-a', 'companies'),
    ).resolves.toBe(1);
    await expect(
      cacheService.getChatResult(user, 'same question', 'companies'),
    ).resolves.toBeNull();
  });

  it('isolates provider variants and invalidates them together', async () => {
    const mockResult = message('mock answer');
    const openAiResult = message('openai answer');

    await cacheService.setChatResult(
      user,
      'same question',
      mockResult,
      'companies-v2',
      'mock',
    );
    await cacheService.setChatResult(
      user,
      'same question',
      openAiResult,
      'companies-v2',
      'openai',
    );

    await expect(
      cacheService.getChatResult(
        user,
        'same question',
        'companies-v2',
        'mock',
      ),
    ).resolves.toEqual(mockResult);
    await expect(
      cacheService.getChatResult(
        user,
        'same question',
        'companies-v2',
        'openai',
      ),
    ).resolves.toEqual(openAiResult);
    await expect(
      cacheService.invalidateChatResults('tenant-a', 'companies-v2'),
    ).resolves.toBe(2);
    await expect(
      cacheService.getChatResult(
        user,
        'same question',
        'companies-v2',
        'mock',
      ),
    ).resolves.toBeNull();
    await expect(
      cacheService.getChatResult(
        user,
        'same question',
        'companies-v2',
        'openai',
      ),
    ).resolves.toBeNull();
  });

  it('supports LangGraph-compatible task checkpoint operations', async () => {
    const checkpointer = new AiTaskStateCheckpointerService(cacheService);
    const config = { configurable: { thread_id: 'task-1' } };
    const storedConfig = await checkpointer.put(
      user,
      config,
      { id: 'checkpoint-1', channel_values: { result: 1 } },
      { source: 'test' },
    );

    await checkpointer.putWrites(user, storedConfig, [['result', 1]]);
    const tuple = await checkpointer.getTuple(user, storedConfig);

    expect(tuple?.checkpoint).toMatchObject({ id: 'checkpoint-1' });
    expect(tuple?.pendingWrites).toEqual([['result', 1]]);

    await checkpointer.deleteThread(user, 'task-1');
    await expect(
      checkpointer.getTuple(user, storedConfig),
    ).resolves.toBeUndefined();
  });
});

function message(text: string): AiChatMessage {
  return {
    id: text,
    role: 'assistant',
    content: { type: 'text', text },
    createdAt: '2026-08-07T00:00:00.000Z',
  };
}
