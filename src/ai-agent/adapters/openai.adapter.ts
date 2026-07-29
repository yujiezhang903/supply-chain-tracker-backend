import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';
import type { ModelAdapter } from './model-adapter.interface';
import type {
  ModelCompletion,
  ModelMessage,
} from '../types/chat-message.type';

@Injectable()
export class OpenAiAdapter
  extends OpenAiCompatibleAdapter
  implements ModelAdapter
{
  constructor(private readonly config: ConfigService) {
    super();
  }

  complete(messages: ModelMessage[]): Promise<ModelCompletion> {
    return this.request(
      {
        provider: 'openai',
        apiKey: this.config.get<string>('OPENAI_API_KEY') ?? '',
        baseUrl:
          this.config.get<string>('OPENAI_BASE_URL') ??
          'https://api.openai.com/v1',
        model: this.config.get<string>('OPENAI_MODEL') ?? '',
      },
      messages,
    );
  }
}
