import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateAiAgentTables1786392000000 implements MigrationInterface {
  name = 'CreateAiAgentTables1786392000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_chat_session'))) {
      await queryRunner.createTable(
        new Table({
          name: 'ai_chat_session',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
            { name: 'tenantId', type: 'varchar', length: '64' },
            { name: 'userId', type: 'uuid' },
            { name: 'title', type: 'varchar', length: '160', default: "'New conversation'" },
            { name: 'model', type: 'varchar', length: '80', default: "'rule-based'" },
            { name: 'status', type: 'varchar', length: '24', default: "'active'" },
            { name: 'provider', type: 'varchar', length: '32', default: "'mock'" },
            { name: 'messages', type: 'jsonb', default: "'[]'::jsonb" },
            { name: 'metadata', type: 'jsonb', default: "'{}'::jsonb" },
            { name: 'closedAt', type: 'timestamptz', isNullable: true },
            { name: 'createdAt', type: 'timestamptz', default: 'now()' },
            { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          ],
          checks: [
            new TableCheck({
              name: 'CHK_ai_chat_session_status',
              expression: '"status" IN (\'active\', \'closed\', \'archived\')',
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_ai_chat_session_user',
              columnNames: ['userId'],
              referencedTableName: 'users',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            }),
          ],
          indices: [
            new TableIndex({
              name: 'IDX_ai_chat_session_tenant_user_updated',
              columnNames: ['tenantId', 'userId', 'updatedAt'],
            }),
            new TableIndex({
              name: 'IDX_ai_chat_session_tenant_status',
              columnNames: ['tenantId', 'status'],
            }),
          ],
        }),
      );
    }

    if (!(await queryRunner.hasTable('ai_user_memory'))) {
      await queryRunner.createTable(
        new Table({
          name: 'ai_user_memory',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
            { name: 'tenantId', type: 'varchar', length: '64' },
            { name: 'userId', type: 'uuid' },
            { name: 'memoryKey', type: 'varchar', length: '120' },
            { name: 'category', type: 'varchar', length: '60', default: "'general'" },
            { name: 'content', type: 'jsonb' },
            { name: 'importance', type: 'smallint', default: '3' },
            { name: 'isActive', type: 'boolean', default: 'true' },
            { name: 'expiresAt', type: 'timestamptz', isNullable: true },
            { name: 'createdAt', type: 'timestamptz', default: 'now()' },
            { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          ],
          uniques: [
            new TableUnique({
              name: 'UQ_ai_user_memory_scope_key',
              columnNames: ['tenantId', 'userId', 'memoryKey'],
            }),
          ],
          checks: [
            new TableCheck({
              name: 'CHK_ai_user_memory_importance',
              expression: '"importance" BETWEEN 1 AND 5',
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_ai_user_memory_user',
              columnNames: ['userId'],
              referencedTableName: 'users',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            }),
          ],
          indices: [
            new TableIndex({
              name: 'IDX_ai_user_memory_tenant_user_updated',
              columnNames: ['tenantId', 'userId', 'updatedAt'],
            }),
            new TableIndex({
              name: 'IDX_ai_user_memory_expiry',
              columnNames: ['expiresAt'],
            }),
          ],
        }),
      );
    }

    if (!(await queryRunner.hasTable('ai_task_record'))) {
      await queryRunner.createTable(
        new Table({
          name: 'ai_task_record',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
            { name: 'tenantId', type: 'varchar', length: '64' },
            { name: 'userId', type: 'uuid' },
            { name: 'sessionId', type: 'uuid', isNullable: true },
            { name: 'taskType', type: 'varchar', length: '100' },
            { name: 'title', type: 'varchar', length: '200' },
            { name: 'status', type: 'varchar', length: '24', default: "'pending'" },
            { name: 'progress', type: 'smallint', default: '0' },
            { name: 'input', type: 'jsonb', default: "'{}'::jsonb" },
            { name: 'output', type: 'jsonb', isNullable: true },
            { name: 'errorMessage', type: 'text', isNullable: true },
            { name: 'startedAt', type: 'timestamptz', isNullable: true },
            { name: 'completedAt', type: 'timestamptz', isNullable: true },
            { name: 'createdAt', type: 'timestamptz', default: 'now()' },
            { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          ],
          checks: [
            new TableCheck({
              name: 'CHK_ai_task_record_status',
              expression: '"status" IN (\'pending\', \'running\', \'completed\', \'failed\', \'cancelled\')',
            }),
            new TableCheck({
              name: 'CHK_ai_task_record_progress',
              expression: '"progress" BETWEEN 0 AND 100',
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_ai_task_record_user',
              columnNames: ['userId'],
              referencedTableName: 'users',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            }),
            new TableForeignKey({
              name: 'FK_ai_task_record_session',
              columnNames: ['sessionId'],
              referencedTableName: 'ai_chat_session',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
            }),
          ],
          indices: [
            new TableIndex({
              name: 'IDX_ai_task_record_tenant_user_status',
              columnNames: ['tenantId', 'userId', 'status'],
            }),
            new TableIndex({
              name: 'IDX_ai_task_record_session',
              columnNames: ['sessionId'],
            }),
            new TableIndex({
              name: 'IDX_ai_task_record_updated',
              columnNames: ['tenantId', 'updatedAt'],
            }),
          ],
        }),
      );
    }

    if (!(await queryRunner.hasTable('ai_operation_audit'))) {
      await queryRunner.createTable(
        new Table({
          name: 'ai_operation_audit',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
            { name: 'tenantId', type: 'varchar', length: '64' },
            { name: 'userId', type: 'uuid', isNullable: true },
            { name: 'action', type: 'varchar', length: '100' },
            { name: 'resourceType', type: 'varchar', length: '100' },
            { name: 'resourceId', type: 'varchar', length: '128', isNullable: true },
            { name: 'outcome', type: 'varchar', length: '24', default: "'success'" },
            { name: 'metadata', type: 'jsonb', default: "'{}'::jsonb" },
            { name: 'ipAddress', type: 'varchar', length: '45', isNullable: true },
            { name: 'userAgent', type: 'varchar', length: '500', isNullable: true },
            { name: 'createdAt', type: 'timestamptz', default: 'now()' },
            { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          ],
          checks: [
            new TableCheck({
              name: 'CHK_ai_operation_audit_outcome',
              expression: '"outcome" IN (\'success\', \'denied\', \'failure\')',
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_ai_operation_audit_user',
              columnNames: ['userId'],
              referencedTableName: 'users',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
            }),
          ],
          indices: [
            new TableIndex({
              name: 'IDX_ai_operation_audit_tenant_user_created',
              columnNames: ['tenantId', 'userId', 'createdAt'],
            }),
            new TableIndex({
              name: 'IDX_ai_operation_audit_tenant_action_created',
              columnNames: ['tenantId', 'action', 'createdAt'],
            }),
            new TableIndex({
              name: 'IDX_ai_operation_audit_resource',
              columnNames: ['resourceType', 'resourceId'],
            }),
          ],
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'ai_operation_audit',
      'ai_task_record',
      'ai_user_memory',
      'ai_chat_session',
    ]) {
      if (await queryRunner.hasTable(table)) {
        await queryRunner.dropTable(table, true);
      }
    }
  }
}
