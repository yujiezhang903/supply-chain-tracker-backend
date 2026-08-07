import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { AiJwtAuthGuard } from '../auth/ai-jwt-auth.guard';
import { CurrentAiUser } from '../auth/current-ai-user.decorator';
import { AiPaginationQueryDto } from '../dto/ai-pagination-query.dto';
import { CreateTaskRecordDto } from '../dto/create-task-record.dto';
import { UpdateTaskRecordDto } from '../dto/update-task-record.dto';
import { AiTaskRecordsService } from '../services/ai-task-records.service';
import type { AiAccessContext } from '../types/ai-access-context.type';

@ApiBearerAuth()
@UseGuards(AiJwtAuthGuard)
@Controller('ai-agent/tasks')
export class AiTaskRecordsController {
  constructor(private readonly tasksService: AiTaskRecordsService) {}

  @Post()
  create(
    @CurrentAiUser() context: AiAccessContext,
    @Body() dto: CreateTaskRecordDto,
  ) {
    return this.tasksService.create(context, dto);
  }

  @Get()
  findAll(
    @CurrentAiUser() context: AiAccessContext,
    @Query() query: AiPaginationQueryDto,
  ) {
    return this.tasksService.findAll(context, query);
  }

  @Get(':id')
  findOne(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tasksService.findOne(context, id);
  }

  @Patch(':id')
  update(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTaskRecordDto,
  ) {
    return this.tasksService.update(context, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tasksService.remove(context, id);
  }
}
