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

import { AiAdminGuard } from '../auth/ai-admin.guard';
import { AiJwtAuthGuard } from '../auth/ai-jwt-auth.guard';
import { CurrentAiUser } from '../auth/current-ai-user.decorator';
import { CreateOperationAuditDto } from '../dto/create-operation-audit.dto';
import { OperationAuditQueryDto } from '../dto/operation-audit-query.dto';
import { UpdateOperationAuditDto } from '../dto/update-operation-audit.dto';
import { AiOperationAuditsService } from '../services/ai-operation-audits.service';
import type { AiAccessContext } from '../types/ai-access-context.type';

@ApiBearerAuth()
@UseGuards(AiJwtAuthGuard)
@Controller('ai-agent/audits')
export class AiOperationAuditsController {
  constructor(private readonly auditsService: AiOperationAuditsService) {}

  @Post()
  @UseGuards(AiAdminGuard)
  create(
    @CurrentAiUser() context: AiAccessContext,
    @Body() dto: CreateOperationAuditDto,
  ) {
    return this.auditsService.create(context, dto);
  }

  @Get()
  findAll(
    @CurrentAiUser() context: AiAccessContext,
    @Query() query: OperationAuditQueryDto,
  ) {
    return this.auditsService.findAll(context, query);
  }

  @Get(':id')
  findOne(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.auditsService.findOne(context, id);
  }

  @Patch(':id')
  @UseGuards(AiAdminGuard)
  update(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOperationAuditDto,
  ) {
    return this.auditsService.update(context, id, dto);
  }

  @Delete(':id')
  @UseGuards(AiAdminGuard)
  remove(
    @CurrentAiUser() context: AiAccessContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.auditsService.remove(context, id);
  }
}
