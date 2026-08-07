import {
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

export class CreateTaskRecordDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string | null;

  @IsString()
  @MaxLength(100)
  taskType!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

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
}
