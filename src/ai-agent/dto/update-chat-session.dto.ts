import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  AI_CHAT_SESSION_STATUSES,
  type AiChatSessionStatus,
} from '../entities/ai-chat-session.entity';
import { AI_PROVIDERS, type AiProvider } from '../types/ai-provider.type';
import type { AiChatMessage } from '../types/chat-message.type';

export class UpdateChatSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsIn(AI_CHAT_SESSION_STATUSES)
  status?: AiChatSessionStatus;

  @IsOptional()
  @IsIn(AI_PROVIDERS)
  provider?: AiProvider;

  @IsOptional()
  @IsArray()
  messages?: AiChatMessage[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
