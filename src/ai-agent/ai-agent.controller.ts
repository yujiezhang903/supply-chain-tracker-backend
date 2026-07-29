import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import {
  AiAgentService,
  type UploadedChatFile,
} from './ai-agent.service';
import { CreateChatSessionDto } from './dto/create-chat-session.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@Controller('ai-agent')
export class AiAgentController {
  constructor(
    private readonly aiAgentService: AiAgentService,
  ) {}

  @Post('sessions')
  createSession(@Body() dto: CreateChatSessionDto) {
    return this.aiAgentService.createSession(dto);
  }

  @Get('sessions')
  findAllSessions() {
    return this.aiAgentService.findAllSessions();
  }

  @Get('sessions/:id')
  findSession(@Param('id') id: string) {
    return this.aiAgentService.findSession(id);
  }

  @Delete('sessions/:id')
  deleteSession(@Param('id') id: string) {
    return this.aiAgentService.deleteSession(id);
  }

  @Post('chat')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  sendMessage(
    @Body() dto: SendChatMessageDto,
    @UploadedFiles() files: UploadedChatFile[] = [],
  ) {
    return this.aiAgentService.sendMessage(dto, files);
  }
}