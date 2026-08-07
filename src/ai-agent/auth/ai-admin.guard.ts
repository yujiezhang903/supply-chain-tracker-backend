import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AiAuthenticatedRequest } from './ai-jwt-auth.guard';

@Injectable()
export class AiAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AiAuthenticatedRequest>();

    if (!request.aiUser?.isAdmin) {
      throw new ForbiddenException('Administrator access is required');
    }

    return true;
  }
}
