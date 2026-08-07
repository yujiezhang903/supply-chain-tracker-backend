import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DeepSeekAdapter } from './deepseek.adapter';
import { MockAdapter } from './mock.adapter';
import { OpenAiAdapter } from './openai.adapter';
import { QwenAdapter } from './qwen.adapter';

import { isAiProvider, type AiProvider } from '../types/ai-provider.type';

import type { ModelCompletion, ModelMessage } from '../types/chat-message.type';

@Injectable()
export class AiModelRouterService {
  constructor(
    private readonly config: ConfigService,
    private readonly deepSeek: DeepSeekAdapter,
    private readonly qwen: QwenAdapter,
    private readonly openAi: OpenAiAdapter,
    private readonly mock: MockAdapter,
  ) {}

  /**
   * 获取环境变量中配置的默认模型
   *
   * 例如：
   * AI_MODEL_PROVIDER=deepseek
   */
  getDefaultProvider(): AiProvider {
    const configured = (this.config.get<string>('AI_MODEL_PROVIDER') ?? 'mock')
      .trim()
      .toLowerCase();

    if (!isAiProvider(configured)) {
      throw new BadRequestException(
        `Unsupported AI_MODEL_PROVIDER: ${configured}. ` +
          'Supported providers: deepseek, qwen, openai, mock',
      );
    }

    return configured;
  }

  /**
   * 验证前端传入的模型名称
   *
   * 支持：
   * deepseek
   * qwen
   * openai
   * mock
   */
  normalizeProvider(provider?: string | null): AiProvider {
    if (!provider || typeof provider !== 'string') {
      return this.getDefaultProvider();
    }

    const normalized = provider.trim().toLowerCase();

    if (!isAiProvider(normalized)) {
      throw new BadRequestException(
        `Unsupported AI provider: ${normalized}. ` +
          'Supported providers: deepseek, qwen, openai, mock',
      );
    }

    return normalized;
  }

  /**
   * 根据模型名称调用对应的适配器
   *
   * 前端可以传：
   * provider: 'deepseek'
   * provider: 'qwen'
   */
  complete(
    provider: string | null | undefined,
    messages: ModelMessage[],
  ): Promise<ModelCompletion> {
    const selectedProvider = this.normalizeProvider(provider);

    switch (selectedProvider) {
      case 'deepseek':
        return this.deepSeek.complete(messages);

      case 'qwen':
        return this.qwen.complete(messages);

      case 'openai':
        return this.openAi.complete(messages);

      case 'mock':
        return this.mock.complete(messages);
    }
  }
}
