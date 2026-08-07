import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { AI_PROVIDERS, type AiProvider } from '../types/ai-provider.type';

export class SendChatMessageDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  content?: string;

  @IsOptional()
  @IsIn(AI_PROVIDERS)
  provider?: AiProvider;
}
