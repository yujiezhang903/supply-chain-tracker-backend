import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AI_PROVIDERS, type AiProvider } from '../types/ai-provider.type';

export class SendChatMessageDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  content!: string;

  @IsOptional()
  @IsIn(AI_PROVIDERS)
  provider?: AiProvider;
}
