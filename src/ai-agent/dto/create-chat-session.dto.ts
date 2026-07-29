import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { AI_PROVIDERS, type AiProvider } from '../types/ai-provider.type';

export class CreateChatSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsIn(AI_PROVIDERS)
  provider?: AiProvider;

  @IsOptional()
  @IsBoolean()
  demo?: boolean;
}
