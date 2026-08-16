import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

type MemoryEntry = {
  value: string;
  expiresAt: number | null;
};

/**
 * The only AI-module service that owns a Redis client. Each operation degrades
 * to an expiring in-process map so local development remains usable when Redis
 * is disabled or temporarily unavailable.
 */
@Injectable()
export class AiRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiRedisService.name);
  private readonly memoryFallback = new Map<string, MemoryEntry>();
  private client: ReturnType<typeof createClient> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const enabled =
      this.configService.get<string>('AI_REDIS_ENABLED', 'true') !== 'false';

    if (!enabled) {
      this.logger.warn(
        'Redis is disabled; AI cache is using in-memory fallback',
      );
      return;
    }

    const client = createClient({
      url: this.configService.get<string>(
        'REDIS_URL',
        'redis://127.0.0.1:6379',
      ),
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: false,
      },
    });

    client.on('error', (error: Error) => {
      this.logger.warn(`Redis error: ${error.message}`);
    });

    try {
      await client.connect();
      this.client = client;
      this.logger.log('AI Redis cache connected');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Redis unavailable (${message}); AI cache is using in-memory fallback`,
      );

      if (client.isOpen) {
        client.destroy();
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  isConnected(): boolean {
    return this.client?.isReady === true;
  }

  async getJson<T>(key: string): Promise<T | null> {
    this.removeExpiredMemoryEntry(key);

    if (this.client?.isReady) {
      try {
        const value = await this.client.get(key);
        return value === null ? null : (JSON.parse(value) as T);
      } catch (error) {
        this.logCommandFallback('GET', error);
      }
    }

    const entry = this.memoryFallback.get(key);
    return entry ? (JSON.parse(entry.value) as T) : null;
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    const normalizedTtl = Math.max(1, Math.floor(ttlSeconds));

    // Keep a local copy even while Redis is healthy. If a later command fails,
    // the same process can continue serving recently written cache entries.
    this.memoryFallback.set(key, {
      value: serialized,
      expiresAt: Date.now() + normalizedTtl * 1000,
    });

    if (this.client?.isReady) {
      try {
        await this.client.setEx(key, normalizedTtl, serialized);
      } catch (error) {
        this.logCommandFallback('SETEX', error);
      }
    }
  }

  async delete(key: string): Promise<void> {
    this.memoryFallback.delete(key);

    if (this.client?.isReady) {
      try {
        await this.client.del(key);
      } catch (error) {
        this.logCommandFallback('DEL', error);
      }
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    const uniqueKeys = [...new Set(keys)];

    if (uniqueKeys.length === 0) {
      return;
    }

    for (const key of uniqueKeys) {
      this.memoryFallback.delete(key);
    }

    if (this.client?.isReady) {
      try {
        await this.client.del(uniqueKeys);
      } catch (error) {
        this.logCommandFallback('DEL', error);
      }
    }
  }

  async addToSet(
    key: string,
    member: string,
    ttlSeconds: number,
  ): Promise<void> {
    this.removeExpiredMemoryEntry(key);
    const fallbackEntry = this.memoryFallback.get(key);
    const existing = fallbackEntry
      ? (JSON.parse(fallbackEntry.value) as string[])
      : [];
    const normalizedTtl = Math.max(1, Math.floor(ttlSeconds));

    this.memoryFallback.set(key, {
      value: JSON.stringify([...new Set([...existing, member])]),
      expiresAt: Date.now() + normalizedTtl * 1000,
    });

    if (this.client?.isReady) {
      try {
        await this.client.sAdd(key, member);
        await this.client.expire(key, normalizedTtl);
      } catch (error) {
        this.logCommandFallback('SADD', error);
      }
    }
  }

  async getSetMembers(key: string): Promise<string[]> {
    if (this.client?.isReady) {
      try {
        return await this.client.sMembers(key);
      } catch (error) {
        this.logCommandFallback('SMEMBERS', error);
      }
    }

    return (await this.getJson<string[]>(key)) ?? [];
  }

  private removeExpiredMemoryEntry(key: string): void {
    const entry = this.memoryFallback.get(key);

    if (entry && entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.memoryFallback.delete(key);
    }
  }

  private logCommandFallback(command: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`${command} failed (${message}); using memory fallback`);
  }
}

