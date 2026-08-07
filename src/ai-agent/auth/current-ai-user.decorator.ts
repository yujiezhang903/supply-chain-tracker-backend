import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AiAccessContext } from '../types/ai-access-context.type';
import type { AiAuthenticatedRequest } from './ai-jwt-auth.guard';

export const CurrentAiUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AiAccessContext => {
    const request = context.switchToHttp().getRequest<AiAuthenticatedRequest>();

    if (!request.aiUser) {
      throw new Error('CurrentAiUser requires AiJwtAuthGuard');
    }

    return request.aiUser;
  },
);
