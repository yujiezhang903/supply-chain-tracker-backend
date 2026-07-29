import { ServiceUnavailableException } from '@nestjs/common';

import type {
  ModelCompletion,
  ModelMessage,
} from '../types/chat-message.type';
import type { AiProvider } from '../types/ai-provider.type';

type AdapterConfig = {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  extraBody?: Record<string, unknown>;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export abstract class OpenAiCompatibleAdapter {
  protected async request(
    config: AdapterConfig,
    messages: ModelMessage[],
  ): Promise<ModelCompletion> {
    if (!config.apiKey || !config.baseUrl || !config.model) {
      throw new ServiceUnavailableException(
        `${config.provider} model configuration is incomplete`,
      );
    }

    const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          stream: false,
          ...config.extraBody,
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        `Cannot connect to the ${config.provider} model service`,
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        payload.error?.message ||
          `${config.provider} model request failed with ${response.status}`,
      );
    }

    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new ServiceUnavailableException(
        `${config.provider} returned an empty response`,
      );
    }

    return {
      provider: config.provider,
      model: config.model,
      text,
    };
  }
}
