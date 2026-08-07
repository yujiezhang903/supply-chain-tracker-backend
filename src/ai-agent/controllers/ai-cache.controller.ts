import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { AiAdminGuard } from '../auth/ai-admin.guard';
import { AiJwtAuthGuard } from '../auth/ai-jwt-auth.guard';
import { CurrentAiUser } from '../auth/current-ai-user.decorator';
import { AiCacheService } from '../cache/ai-cache.service';
import { AiRedisService } from '../cache/ai-redis.service';
import type { AiAccessContext } from '../types/ai-access-context.type';

@ApiBearerAuth()
@UseGuards(AiJwtAuthGuard, AiAdminGuard)
@Controller('ai-agent/cache')
export class AiCacheController {
  constructor(
    private readonly cacheService: AiCacheService,
    private readonly redisService: AiRedisService,
  ) {}

  @Get('status')
  status() {
    return {
      redisConnected: this.redisService.isConnected(),
      modelCache: 'placeholder',
    };
  }

  @Delete('chat/:businessDimension')
  async invalidateChatCache(
    @CurrentAiUser() context: AiAccessContext,
    @Param('businessDimension') businessDimension: string,
  ) {
    const invalidated = await this.cacheService.invalidateChatResults(
      context.tenantId,
      businessDimension,
    );
    return { businessDimension, invalidated };
  }
}
