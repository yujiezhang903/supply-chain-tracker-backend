import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';
import type { ModelAdapter } from './model-adapter.interface';
import type {
  ModelCompletion,
  ModelMessage,
} from '../types/chat-message.type';

@Injectable()
export class DeepSeekAdapter
  extends OpenAiCompatibleAdapter
  implements ModelAdapter
{
  constructor(private readonly config: ConfigService) {
    super();
  }

  complete(messages: ModelMessage[]): Promise<ModelCompletion> {
    return this.request(
      {
        provider: 'deepseek',
        apiKey: this.config.get<string>('DEEPSEEK_API_KEY') ?? '',
        baseUrl:
          this.config.get<string>('DEEPSEEK_BASE_URL') ??
          'https://api.deepseek.com',
        model:
          this.config.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-v4-pro',
        extraBody: {
          thinking: { type: 'enabled' },
          reasoning_effort: 'high',
        },
      },
      messages,
    );
  }
}
