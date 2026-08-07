import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';

import { AiJwtAuthGuard } from './auth/ai-jwt-auth.guard';
import { CurrentAiUser } from './auth/current-ai-user.decorator';
import { AiAgentService, type UploadedChatFile } from './ai-agent.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import type { AiAccessContext } from './types/ai-access-context.type';

@ApiBearerAuth()
@UseGuards(AiJwtAuthGuard)
@Controller('ai-agent')
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Post('chat')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  sendMessage(
    @CurrentAiUser() context: AiAccessContext,
    @Body() dto: SendChatMessageDto,
    @UploadedFiles() files: UploadedChatFile[] = [],
  ) {
    return this.aiAgentService.sendMessage(context, dto, files);
  }
}
