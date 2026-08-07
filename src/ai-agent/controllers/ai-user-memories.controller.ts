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
import { CreateUserMemoryDto } from '../dto/create-user-memory.dto';
import { UpdateUserMemoryDto } from '../dto/update-user-memory.dto';
import { AiUserMemoriesService } from '../services/ai-user-memories.service';
import type { AiAccessContext } from '../types/ai-access-context.type';

@ApiBearerAuth()
@UseGuards(AiJwtAuthGuard)
@Controller('ai-agent/memories')
export class AiUserMemoriesController {
  constructor(private readonly memoriesService: AiUserMemoriesService) {}

  @Post()
  create(
    @CurrentAiUser() context: AiAccessContext,
    @Body() dto: CreateUserMemoryDto,
  ) {
    return this.memoriesService.create(context, dto);
  }

  @Get()
  findAll(
    @CurrentAiUser() context: AiAccessContext,
    @Query() query: AiPaginationQueryDto,
  ) {
    return this.memoriesService.findAll(context, query);
  }

  @Get(':id')
  findOne(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.memoriesService.findOne(context, id);
  }

  @Patch(':id')
  update(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserMemoryDto,
  ) {
    return this.memoriesService.update(context, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.memoriesService.remove(context, id);
  }
}
