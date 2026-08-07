import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  AI_TASK_STATUSES,
  type AiTaskStatus,
} from '../entities/ai-task-record.entity';

export class UpdateTaskRecordDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taskType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsIn(AI_TASK_STATUSES)
  status?: AiTaskStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  output?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  errorMessage?: string | null;

  @IsOptional()
  @IsDateString()
  startedAt?: string | null;

  @IsOptional()
  @IsDateString()
  completedAt?: string | null;
}
