import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ChatRequestDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}
