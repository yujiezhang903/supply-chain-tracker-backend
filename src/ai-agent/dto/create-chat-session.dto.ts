import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { AI_PROVIDERS, type AiProvider } from '../types/ai-provider.type';

export class CreateChatSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsIn(AI_PROVIDERS)
  provider?: AiProvider;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  demo?: boolean;
}
