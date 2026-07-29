import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';
import type { ModelAdapter } from './model-adapter.interface';
import type {
  ModelCompletion,
  ModelMessage,
} from '../types/chat-message.type';

@Injectable()
export class QwenAdapter
  extends OpenAiCompatibleAdapter
  implements ModelAdapter
{
  constructor(private readonly config: ConfigService) {
    super();
  }

  complete(messages: ModelMessage[]): Promise<ModelCompletion> {
    return this.request(
      {
        provider: 'qwen',
        apiKey: this.config.get<string>('DASHSCOPE_API_KEY') ?? '',
        baseUrl: this.config.get<string>('QWEN_BASE_URL') ?? '',
        model: this.config.get<string>('QWEN_MODEL') ?? 'qwen3.5-plus',
        extraBody: {
          enable_thinking: false,
        },
      },
      messages,
    );
  }
}
