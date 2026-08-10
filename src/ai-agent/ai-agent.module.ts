import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompaniesModule } from '../companies/companies.module';
import { User } from '../users/entities/user.entity';
import { AiModelRouterService } from './adapters/ai-model-router.service';
import { DeepSeekAdapter } from './adapters/deepseek.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { QwenAdapter } from './adapters/qwen.adapter';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { AiAdminGuard } from './auth/ai-admin.guard';
import { AiJwtAuthGuard } from './auth/ai-jwt-auth.guard';
import { AiCacheService } from './cache/ai-cache.service';
import { AiRedisService } from './cache/ai-redis.service';
import { AiTaskStateCheckpointerService } from './cache/ai-task-state-checkpointer.service';
import { LangGraphCheckpointerFactory } from './cache/langgraph-redis-checkpointer';
import { AiCacheController } from './controllers/ai-cache.controller';
import { AiChatSessionsController } from './controllers/ai-chat-sessions.controller';
import { AiOperationAuditsController } from './controllers/ai-operation-audits.controller';
import { AiTaskRecordsController } from './controllers/ai-task-records.controller';
import { AiUserMemoriesController } from './controllers/ai-user-memories.controller';
import { AiChatSession } from './entities/ai-chat-session.entity';
import { AiOperationAudit } from './entities/ai-operation-audit.entity';
import { AiTaskRecord } from './entities/ai-task-record.entity';
import { AiUserMemory } from './entities/ai-user-memory.entity';
import { AiChatSessionsService } from './services/ai-chat-sessions.service';
import { AiOperationAuditsService } from './services/ai-operation-audits.service';
import { AiTaskRecordsService } from './services/ai-task-records.service';
import { AiUserMemoriesService } from './services/ai-user-memories.service';

@Module({
  imports: [
    ConfigModule,
    CompaniesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'dev_jwt_secret_change_later',
        ),
        signOptions: { expiresIn: '1d' },
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      AiChatSession,
      AiUserMemory,
      AiTaskRecord,
      AiOperationAudit,
    ]),
  ],
  controllers: [
    AiAgentController,
    AiChatSessionsController,
    AiUserMemoriesController,
    AiTaskRecordsController,
    AiOperationAuditsController,
    AiCacheController,
  ],
  providers: [
    AiAgentService,
    AiChatSessionsService,
    AiUserMemoriesService,
    AiTaskRecordsService,
    AiOperationAuditsService,
    AiRedisService,
    AiCacheService,
    AiTaskStateCheckpointerService,
    LangGraphCheckpointerFactory,
    AiJwtAuthGuard,
    AiAdminGuard,
    AiModelRouterService,
    DeepSeekAdapter,
    QwenAdapter,
    OpenAiAdapter,
    MockAdapter,
  ],
  exports: [
    AiAgentService,
    AiChatSessionsService,
    AiUserMemoriesService,
    AiTaskRecordsService,
    AiOperationAuditsService,
    AiCacheService,
    AiTaskStateCheckpointerService,
    LangGraphCheckpointerFactory,
  ],
})
export class AiAgentModule {}
