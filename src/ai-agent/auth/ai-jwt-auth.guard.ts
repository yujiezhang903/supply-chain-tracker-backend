import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import type { AiAccessContext } from '../types/ai-access-context.type';

type AiJwtPayload = {
  sub?: string;
  email?: string;
  role?: string;
  tenantId?: string;
};

export type AiAuthenticatedRequest = Request & {
  aiUser?: AiAccessContext;
};

@Injectable()
export class AiJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AiAuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('A valid bearer token is required');
    }

    let payload: AiJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<AiJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('The bearer token is invalid or expired');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('The bearer token has no user subject');
    }

    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || user.status.toLowerCase() !== 'active') {
      throw new UnauthorizedException('The user is unavailable or inactive');
    }

    const tenantId = this.normalizeTenantId(
      payload.tenantId ??
        this.configService.get<string>('AI_DEFAULT_TENANT_ID') ??
        'default',
    );
    const normalizedRole = user.role.trim().toLowerCase();

    request.aiUser = {
      userId: user.id,
      tenantId,
      email: user.email,
      role: user.role,
      isAdmin: ['admin', 'administrator'].includes(normalizedRole),
    };

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }

  private normalizeTenantId(value: string): string {
    const tenantId = value.trim();

    if (!/^[A-Za-z0-9_-]{1,64}$/.test(tenantId)) {
      throw new UnauthorizedException('The token contains an invalid tenant');
    }

    return tenantId;
  }
}
