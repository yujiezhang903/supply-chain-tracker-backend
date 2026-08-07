import { Injectable } from '@nestjs/common';

import type { ModelAdapter } from './model-adapter.interface';
import type { ModelCompletion, ModelMessage } from '../types/chat-message.type';

@Injectable()
export class MockAdapter implements ModelAdapter {
  complete(messages: ModelMessage[]): Promise<ModelCompletion> {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    return Promise.resolve({
      provider: 'mock',
      model: 'local-mock',
      text: [
        '### AI Agent framework is connected',
        '',
        `I received: **${lastUserMessage?.content ?? ''}**`,
        '',
        '- The chat request reached the NestJS module.',
        '- This reply was persisted with the session.',
        '- Set `AI_MODEL_PROVIDER` to `deepseek`, `qwen`, or `openai` to use a real model.',
      ].join('\n'),
    });
  }
}
