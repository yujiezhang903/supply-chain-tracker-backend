import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { AiModelRouterService } from './adapters/ai-model-router.service';
import { DeepSeekAdapter } from './adapters/deepseek.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { QwenAdapter } from './adapters/qwen.adapter';
import { AiChatSession } from './entities/ai-chat-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiChatSession])],
  controllers: [AiAgentController],
  providers: [
    AiAgentService,
    AiModelRouterService,
    DeepSeekAdapter,
    QwenAdapter,
    OpenAiAdapter,
    MockAdapter,
  ],
  exports: [AiAgentService],
})
export class AiAgentModule {}
