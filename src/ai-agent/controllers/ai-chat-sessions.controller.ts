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

import { AiAgentService } from '../ai-agent.service';
import { AiJwtAuthGuard } from '../auth/ai-jwt-auth.guard';
import { CurrentAiUser } from '../auth/current-ai-user.decorator';
import { AiPaginationQueryDto } from '../dto/ai-pagination-query.dto';
import { CreateChatSessionDto } from '../dto/create-chat-session.dto';
import { UpdateChatSessionDto } from '../dto/update-chat-session.dto';
import { AiChatSessionsService } from '../services/ai-chat-sessions.service';
import type { AiAccessContext } from '../types/ai-access-context.type';

@ApiBearerAuth()
@UseGuards(AiJwtAuthGuard)
@Controller('ai-agent/sessions')
export class AiChatSessionsController {
  constructor(
    private readonly aiAgentService: AiAgentService,
    private readonly sessionsService: AiChatSessionsService,
  ) {}

  @Post()
  create(
    @CurrentAiUser() context: AiAccessContext,
    @Body() dto: CreateChatSessionDto,
  ) {
    return this.aiAgentService.createSession(context, dto);
  }

  @Get()
  findAll(
    @CurrentAiUser() context: AiAccessContext,
    @Query() query: AiPaginationQueryDto,
  ) {
    return this.sessionsService.findAll(context, query);
  }

  @Get(':id')
  findOne(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sessionsService.findOne(context, id);
  }

  @Patch(':id')
  update(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateChatSessionDto,
  ) {
    return this.sessionsService.update(context, id, dto);
  }

  @Post(':id/close')
  close(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sessionsService.close(context, id);
  }

  @Delete(':id')
  remove(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sessionsService.remove(context, id);
  }
}
