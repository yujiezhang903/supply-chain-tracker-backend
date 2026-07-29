import type {
  ModelCompletion as ExistingModelCompletion,
  ModelMessage as ExistingModelMessage,
} from '../types/chat-message.type';

import type { AiProvider } from '../types/ai-provider.type';

export type ModelMessage = ExistingModelMessage;

export type ModelProvider = AiProvider;

export type ModelCompletion = Omit<
  ExistingModelCompletion,
  'provider'
> & {
  provider: ModelProvider;
};

export interface ModelAdapter {
  complete(messages: ModelMessage[]): Promise<ModelCompletion>;
}