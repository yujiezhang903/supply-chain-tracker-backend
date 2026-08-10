import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import type { AiChatSession } from '../entities/ai-chat-session.entity';
import type { AiOperationAudit } from '../entities/ai-operation-audit.entity';
import type { AiTaskRecord } from '../entities/ai-task-record.entity';
import type { AiUserMemory } from '../entities/ai-user-memory.entity';
import type { AiAccessContext } from '../types/ai-access-context.type';
import { AiChatSessionsService } from './ai-chat-sessions.service';
import { AiOperationAuditsService } from './ai-operation-audits.service';
import { AiTaskRecordsService } from './ai-task-records.service';
import { AiUserMemoriesService } from './ai-user-memories.service';

describe('AI data access isolation', () => {
  const user: AiAccessContext = {
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-a',
    email: 'user@example.com',
    role: 'Viewer',
    isAdmin: false,
  };
  const admin: AiAccessContext = {
    ...user,
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'admin@example.com',
    role: 'Admin',
    isAdmin: true,
  };

  const audits = { record: jest.fn().mockResolvedValue(undefined) };
  const cache = {
    clearSession: jest.fn().mockResolvedValue(undefined),
    deleteTaskState: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes session, memory and task ID lookups to tenant and user', async () => {
    const sessionRepo = repository<AiChatSession>();
    const memoryRepo = repository<AiUserMemory>();
    const taskRepo = repository<AiTaskRecord>();

    sessionRepo.findOne.mockResolvedValue(null);
    memoryRepo.findOne.mockResolvedValue(null);
    taskRepo.findOne.mockResolvedValue(null);

    const sessions = new AiChatSessionsService(
      sessionRepo,
      cache as never,
      audits as never,
    );
    const memories = new AiUserMemoriesService(memoryRepo, audits as never);
    const tasks = new AiTaskRecordsService(
      taskRepo,
      sessions,
      cache as never,
      audits as never,
    );

    await expect(sessions.findOne(user, recordId())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(memories.findOne(user, recordId())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(tasks.findOne(user, recordId())).rejects.toBeInstanceOf(
      NotFoundException,
    );

    for (const repo of [sessionRepo, memoryRepo, taskRepo]) {
      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          id: recordId(),
          tenantId: user.tenantId,
          userId: user.userId,
        },
      });
    }
  });

  it('rejects a normal user attempting to filter by another user', async () => {
    const sessionRepo = repository<AiChatSession>();
    const sessions = new AiChatSessionsService(
      sessionRepo,
      cache as never,
      audits as never,
    );

    await expect(
      sessions.findAll(user, {
        page: 1,
        limit: 20,
        userId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(sessionRepo.findAndCount).not.toHaveBeenCalled();
  });

  it('clears the short-term cache when a session is closed', async () => {
    const sessionRepo = repository<AiChatSession>();
    const session = {
      id: recordId(),
      tenantId: user.tenantId,
      userId: user.userId,
      status: 'active',
      closedAt: null,
    } as AiChatSession;
    sessionRepo.findOne.mockResolvedValue(session);
    sessionRepo.save.mockImplementation(async (value) => value);

    const sessions = new AiChatSessionsService(
      sessionRepo,
      cache as never,
      audits as never,
    );
    await sessions.close(user, session.id);

    expect(cache.clearSession).toHaveBeenCalledWith(user, session.id);
    expect(session.status).toBe('closed');
  });

  it('limits normal audit reads to self and admin reads to the current tenant', async () => {
    const auditRepo = repository<AiOperationAudit>();
    auditRepo.findAndCount.mockResolvedValue([[], 0]);
    const service = new AiOperationAuditsService(auditRepo);

    await service.findAll(user, { page: 1, limit: 20 });
    expect(auditRepo.findAndCount).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          tenantId: user.tenantId,
          userId: user.userId,
        },
      }),
    );

    await service.findAll(admin, { page: 1, limit: 20 });
    expect(auditRepo.findAndCount).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { tenantId: admin.tenantId },
      }),
    );
  });

  it('never returns an audit outside the current tenant', async () => {
    const auditRepo = repository<AiOperationAudit>();
    auditRepo.findOne.mockResolvedValue(null);
    const service = new AiOperationAuditsService(auditRepo);

    await expect(service.findOne(admin, recordId())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(auditRepo.findOne).toHaveBeenCalledWith({
      where: {
        id: recordId(),
        tenantId: admin.tenantId,
      },
    });
  });
});

function recordId(): string {
  return '33333333-3333-4333-8333-333333333333';
}

function repository<T>(): jest.Mocked<Repository<T>> {
  return {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<Repository<T>>;
}
