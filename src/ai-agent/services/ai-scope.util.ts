import { ForbiddenException } from '@nestjs/common';

import type { AiPaginationQueryDto } from '../dto/ai-pagination-query.dto';
import type { AiAccessContext } from '../types/ai-access-context.type';

export function assertSelfFilter(
  context: AiAccessContext,
  requestedUserId?: string,
): void {
  if (requestedUserId && requestedUserId !== context.userId) {
    throw new ForbiddenException('Cross-user AI data access is not allowed');
  }
}

export function assertAdmin(context: AiAccessContext): void {
  if (!context.isAdmin) {
    throw new ForbiddenException('Administrator access is required');
  }
}

export function pagination(query: AiPaginationQueryDto): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { page, limit, skip: (page - 1) * limit };
}

export function paginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    data,
    page,
    limit,
    total,
    pageCount: Math.ceil(total / limit),
  };
}
