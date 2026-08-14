import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { CompaniesService } from '../companies/companies.service';
import { AiModelRouterService } from './adapters/ai-model-router.service';
import {
  AI_SESSION_MESSAGE_LIMIT,
  AiCacheService,
} from './cache/ai-cache.service';
import { CreateChatSessionDto } from './dto/create-chat-session.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { AiChatSessionsService } from './services/ai-chat-sessions.service';
import { AiOperationAuditsService } from './services/ai-operation-audits.service';
import type { AiAccessContext } from './types/ai-access-context.type';
import type { AiChatMessage, ModelMessage } from './types/chat-message.type';

export type UploadedChatFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type CompanyView = {
  id: string;
  name: string;
  level: string;
  country: string;
  city: string;
  foundedYear: number | null;
  annualRevenue: number;
  employees: number;
  profitEfficiency: number;
};

type JsonRecord = Record<string, unknown>;

const COMPANY_CHAT_CACHE_DIMENSION = 'companies-v2';
const FILE_CONTEXT_CHARACTER_LIMIT = 12_000;
const MODEL_CONTEXT_MESSAGE_LIMIT = 30;

/**
 * Coordinates a complete chat turn while keeping persistence, caching,
 * business-data access and model transport behind their owning services.
 * Deterministic company queries run before model calls so dashboard totals and
 * rankings always come from verified database records.
 */
@Injectable()
export class AiAgentService {
  constructor(
    private readonly modelRouter: AiModelRouterService,
    private readonly companiesService: CompaniesService,
    private readonly sessionsService: AiChatSessionsService,
    private readonly cacheService: AiCacheService,
    private readonly auditsService: AiOperationAuditsService,
  ) {}

  async createSession(context: AiAccessContext, dto: CreateChatSessionDto) {
    const provider = this.modelRouter.normalizeProvider(dto.provider);
    const messages = dto.demo
      ? this.createDemoMessages()
      : [
          this.createTextMessage(
            'assistant',
            'Hi! I can help you inspect supply-chain data and prepare reports. What would you like to analyse?',
          ),
        ];

    return this.sessionsService.create(
      context,
      {
        ...dto,
        title: dto.title?.trim() || 'New conversation',
        provider,
      },
      messages,
    );
  }

  async sendMessage(
    context: AiAccessContext,
    dto: SendChatMessageDto,
    files: UploadedChatFile[] = [],
  ) {
    const session = dto.sessionId
      ? await this.sessionsService.findOne(context, dto.sessionId)
      : await this.createSession(context, {
          provider: dto.provider,
        });
    const provider = this.modelRouter.normalizeProvider(
      dto.provider ?? session.provider,
    );
    const userContent = dto.content?.trim() ?? '';

    if (!userContent && files.length === 0) {
      return {
        session,
        provider,
        model: session.model,
        cacheHit: false,
        userMessage: null,
        assistantMessage: this.createTextMessage(
          'assistant',
          'Please enter a message or attach a file.',
        ),
      };
    }

    const attachments = files.map((file) => ({
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    }));
    const userMessage: AiChatMessage = {
      ...this.createTextMessage(
        'user',
        userContent || 'Please analyse the attached file.',
      ),
      ...(attachments.length > 0 ? { attachments } : {}),
    };
    const previousContext = await this.cacheService.getSessionContext(
      context,
      session.id,
      () => session.messages ?? [],
    );
    const conversationContext = [...previousContext, userMessage].slice(
      -AI_SESSION_MESSAGE_LIMIT,
    );
    const nextTitle =
      session.title === 'New conversation'
        ? userContent.slice(0, 80) || 'File analysis'
        : undefined;

    await this.sessionsService.appendMessages(
      context,
      session.id,
      [userMessage],
      undefined,
      provider,
      nextTitle,
    );

    // Model-generated answers are provider-specific. Including the provider in
    // the dimension prevents a response from one model being served after the
    // user switches to another model with the same question.
    const chatCacheDimension =
      COMPANY_CHAT_CACHE_DIMENSION + '-' + provider;
    const cachedMessage =
      files.length === 0 && userContent
        ? await this.cacheService.getChatResult(
            context,
            userContent,
            chatCacheDimension,
          )
        : null;
    let cacheHit = cachedMessage !== null;
    let assistantMessage: AiChatMessage | null = cachedMessage
      ? {
          ...cachedMessage,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        }
      : null;
    let responseModel = 'rule-based';
    let responseProvider = provider;

    if (!assistantMessage) {
      cacheHit = false;
      const companies = await this.loadCompanies();
      const ruleMessage = this.createRuleBasedReply(companies, userContent);

      if (ruleMessage) {
        assistantMessage = ruleMessage;
      } else {
        const modelMessages = this.toModelMessages(
          conversationContext,
          companies,
        );
        const fileContext = this.extractFileContext(files);
        const lastMessage = modelMessages.at(-1);

        if (fileContext && lastMessage?.role === 'user') {
          lastMessage.content += '\n\n' + fileContext;
        }

        const completion = await this.modelRouter.complete(
          provider,
          modelMessages,
        );

        responseProvider = completion.provider;
        responseModel = completion.model;
        assistantMessage = this.createTextMessage('assistant', completion.text);
      }

      if (files.length === 0 && userContent) {
        await this.cacheService.setChatResult(
          context,
          userContent,
          assistantMessage,
          chatCacheDimension,
        );
      }
    } else {
      responseModel = 'cache';
    }

    if (!assistantMessage) {
      throw new Error('AI response generation did not produce a message');
    }

    const savedSession = await this.sessionsService.appendMessages(
      context,
      session.id,
      [assistantMessage],
      responseModel,
      responseProvider,
    );
    await this.auditsService.record(context, {
      action: 'chat.message',
      resourceType: 'ai_chat_session',
      resourceId: session.id,
      metadata: {
        provider: responseProvider,
        model: responseModel,
        cacheHit,
        attachmentCount: files.length,
      },
    });

    return {
      session: savedSession,
      provider: responseProvider,
      model: responseModel,
      cacheHit,
      userMessage,
      assistantMessage,
    };
  }

  /**
   * Reduce business entities to the fields that may be supplied to the model.
   * Access stays behind CompaniesService rather than an AI-owned repository.
   */
  private async loadCompanies(): Promise<CompanyView[]> {
    try {
      const rows = await this.companiesService.findAll();

      return rows
        .map((row, index) => this.toCompanyView(this.asRecord(row), index))
        .filter((company) => company.name.length > 0);
    } catch {
      return [];
    }
  }

  private toCompanyView(row: JsonRecord, index: number): CompanyView {
    const id =
      this.readString(row, ['id', 'companyId', 'company_id']) ||
      'company-' + (index + 1);
    const name = this.readString(row, ['name', 'companyName', 'company_name']);
    const level = this.readString(row, ['level']);
    const country = this.readString(row, ['country']);
    const city = this.readString(row, ['city']);
    const foundedYear = this.readNumberOrNull(row, [
      'foundedYear',
      'founded_year',
    ]);
    const annualRevenue = this.readNumber(row, [
      'annualRevenue',
      'annual_revenue',
      'revenue',
    ]);
    const employees = this.readNumber(row, [
      'employees',
      'employeeCount',
      'employee_count',
    ]);

    return {
      id,
      name,
      level,
      country,
      city,
      foundedYear,
      annualRevenue,
      employees,
      profitEfficiency: employees > 0 ? annualRevenue / employees : 0,
    };
  }

  /**
   * Answer common dashboard questions without an LLM. This keeps structured
   * tables, charts and counts reproducible from the same company snapshot.
   */
  private createRuleBasedReply(
    companies: CompanyView[],
    input: string,
  ): AiChatMessage | null {
    const query = input.toLowerCase();
    const requestedLevel = this.extractRequestedLevel(companies, query);
    const asksForLevelDistribution = this.includesAny(query, [
      'distribution',
      'breakdown',
      'chart',
      'graph',
      'statistics',
      '统计各',
      '等级统计',
      '级别统计',
      '等级分布',
      '级别分布',
      '图表',
    ]);

    if (requestedLevel && !asksForLevelDistribution) {
      const normalizedLevel = this.normalizeLevel(requestedLevel);
      const filteredCompanies = companies.filter(
        (company) => this.normalizeLevel(company.level) === normalizedLevel,
      );
      const sortBy = this.includesAny(query, [
        'employee',
        'employees',
        'staff',
        '员工',
        '雇员',
      ])
        ? 'employees'
        : this.includesAny(query, [
              'revenue',
              'income',
              'annual revenue',
              '营收',
              '收入',
              '盈利',
            ])
          ? 'revenue'
          : 'name';

      return filteredCompanies.length > 0
        ? this.createCompanyTable(
            filteredCompanies,
            sortBy,
            requestedLevel + ' companies',
          )
        : this.createTextMessage(
            'assistant',
            'No companies were found for ' + requestedLevel + '.',
          );
    }

    if (this.includesAny(query, ['level', '等级', '级别', '层级'])) {
      return companies.length > 0
        ? this.createDistributionChart(companies, 'level', 'Companies by level')
        : this.createTextMessage(
            'assistant',
            'No company records are currently available in the database.',
          );
    }

    if (
      this.includesAny(query, [
        'country',
        'countries',
        '国家',
        '地域',
        '地区分布',
      ])
    ) {
      return companies.length > 0
        ? this.createDistributionChart(
            companies,
            'country',
            'Companies by country',
          )
        : this.createTextMessage(
            'assistant',
            'No company records are currently available in the database.',
          );
    }

    if (
      this.includesAny(query, [
        'revenue',
        'income',
        'annual revenue',
        '营收',
        '收入',
        '盈利',
      ])
    ) {
      return companies.length > 0
        ? this.createCompanyTable(
            companies,
            'revenue',
            'Top companies by annual revenue',
          )
        : this.createTextMessage(
            'assistant',
            'No company records are currently available in the database.',
          );
    }

    if (
      this.includesAny(query, [
        'employee',
        'employees',
        'staff',
        '员工',
        '雇员',
      ])
    ) {
      return companies.length > 0
        ? this.createCompanyTable(
            companies,
            'employees',
            'Top companies by employee count',
          )
        : this.createTextMessage(
            'assistant',
            'No company records are currently available in the database.',
          );
    }

    if (
      this.includesAny(query, [
        'list companies',
        'company list',
        '列出',
        '公司列表',
        '有哪些公司',
        '查看公司',
      ])
    ) {
      return companies.length > 0
        ? this.createCompanyTable(companies, 'name', 'Company list')
        : this.createTextMessage(
            'assistant',
            'No company records are currently available in the database.',
          );
    }

    if (
      this.includesAny(query, [
        'how many',
        'how many companies',
        'number of companies',
        'total companies',
        'total number of companies',
        'company count',
        '多少公司',
        '多少家公司',
        '多少家',
        '共有多少',
        '一共有多少',
        '公司数量',
        '公司总数',
        '公司有多少',
      ])
    ) {
      const isChinese = /[\u4e00-\u9fff]/.test(input);

      return this.createTextMessage(
        'assistant',
        companies.length > 0
          ? isChinese
            ? '目前数据库中共有 **' + companies.length + ' 家公司**。'
            : 'There are currently **' +
              companies.length +
              ' companies** in the database.'
          : isChinese
            ? '目前数据库中没有公司记录。'
            : 'There are currently no company records available in the database.',
      );
    }

    return null;
  }

  /**
   * Serialize structured chat messages and prepend the verified company
   * snapshot so model responses can preserve exact dashboard values.
   */
  private toModelMessages(
    messages: AiChatMessage[],
    companies: CompanyView[],
  ): ModelMessage[] {
    const conversation: ModelMessage[] = [
      {
        role: 'system',
        content: [
          'You are the AI assistant inside a supply-chain tracking dashboard.',
          'Reply in the same language as the user.',
          'Give concise, practical answers and use Markdown when useful.',
          'Use only facts explicitly provided in the conversation, verified database records, or attached files.',
          'Never invent company names, revenue values, employee counts, rankings, totals, or other business facts.',
          'If the available information does not contain the answer, say that the information is not available instead of guessing.',
          'Never replace real company records with placeholders such as Company A, Company B, or Company C.',
          'When the user asks to simplify or explain a previous answer, preserve the exact company names and values from the previous structured table or chart.',
          'Structured dashboard tables and charts are real data, not examples.',
          'Do not claim that you changed database data.',
          '',
          this.createDatabaseContext(companies),
        ].join('\n'),
      },
    ];

    for (const message of messages.slice(-MODEL_CONTEXT_MESSAGE_LIMIT)) {
      const content = this.formatMessageForModel(message);

      if (!content) {
        continue;
      }

      conversation.push({
        role: message.role,
        content,
      });
    }

    return conversation;
  }

  private createDatabaseContext(companies: CompanyView[]): string {
    if (companies.length === 0) {
      return 'Database company records: none available.';
    }

    return ['Database company records (JSON):', JSON.stringify(companies)].join(
      '\n',
    );
  }

  private formatMessageForModel(message: AiChatMessage): string {
    const content = message.content;

    switch (content.type) {
      case 'text':
        return content.text;
      case 'table':
        return [
          content.title || 'Table',
          JSON.stringify({
            columns: content.columns,
            rows: content.rows,
          }),
        ].join('\n');
      case 'chart':
        return [
          content.title,
          JSON.stringify({
            chartType: content.chartType,
            labels: content.labels,
            datasets: content.datasets,
          }),
        ].join('\n');
      case 'report':
        return [content.title, content.summary].join('\n');
      case 'confirmation':
        return [content.title, content.description].join('\n');
    }
  }

  private createDistributionChart(
    companies: CompanyView[],
    field: 'level' | 'country',
    title: string,
  ): AiChatMessage {
    const counts = new Map<string, number>();

    for (const company of companies) {
      const value = company[field] || 'Unknown';
      counts.set(value, (counts.get(value) || 0) + 1);
    }

    const labels = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));

    return {
      id: randomUUID(),
      role: 'assistant',
      content: {
        type: 'chart',
        title,
        chartType: 'bar',
        labels,
        datasets: [
          {
            label: 'Companies',
            data: labels.map((label) => counts.get(label) || 0),
          },
        ],
      },
      createdAt: new Date().toISOString(),
    };
  }

  private createCompanyTable(
    companies: CompanyView[],
    sortBy: 'name' | 'revenue' | 'employees',
    title: string,
  ): AiChatMessage {
    const sortedCompanies = [...companies].sort((first, second) => {
      if (sortBy === 'revenue') {
        return (
          second.annualRevenue - first.annualRevenue ||
          first.name.localeCompare(second.name)
        );
      }

      if (sortBy === 'employees') {
        return (
          second.employees - first.employees ||
          first.name.localeCompare(second.name)
        );
      }

      return first.name.localeCompare(second.name);
    });

    return {
      id: randomUUID(),
      role: 'assistant',
      content: {
        type: 'table',
        title,
        columns: [
          { key: 'name', label: 'Company' },
          { key: 'level', label: 'Level' },
          { key: 'country', label: 'Country' },
          { key: 'city', label: 'City' },
          { key: 'annualRevenue', label: 'Annual Revenue' },
          { key: 'employees', label: 'Employees' },
        ],
        rows: sortedCompanies.slice(0, 20).map((company) => ({
          name: company.name || 'Unnamed company',
          level: company.level || 'Unknown',
          country: company.country || 'Unknown',
          city: company.city || 'Unknown',
          annualRevenue: this.formatCurrency(company.annualRevenue),
          employees: company.employees,
        })),
      },
      createdAt: new Date().toISOString(),
    };
  }

  private createTextMessage(
    role: 'user' | 'assistant',
    text: string,
  ): AiChatMessage {
    return {
      id: randomUUID(),
      role,
      content: {
        type: 'text',
        text,
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Include text-like attachments only and cap their combined prompt size.
   * Binary files remain as attachment metadata and are never decoded here.
   */
  private extractFileContext(files: UploadedChatFile[]): string {
    const readableMimeTypes = new Set([
      'application/json',
      'text/csv',
      'text/plain',
      'text/markdown',
    ]);
    const sections: string[] = [];
    let remainingCharacters = FILE_CONTEXT_CHARACTER_LIMIT;

    for (const file of files) {
      const mimeType = file.mimetype.toLowerCase();

      if (
        remainingCharacters <= 0 ||
        (!mimeType.startsWith('text/') && !readableMimeTypes.has(mimeType))
      ) {
        continue;
      }

      const content = file.buffer
        .toString('utf8')
        .split('\u0000')
        .join('')
        .slice(0, remainingCharacters);

      if (!content.trim()) {
        continue;
      }

      sections.push('File: ' + file.originalname + '\n' + content);
      remainingCharacters -= content.length;
    }

    return sections.length > 0
      ? 'Attached file content:\n\n' + sections.join('\n\n')
      : '';
  }

  private createDemoMessages(): AiChatMessage[] {
    const now = new Date().toISOString();

    return [
      this.createTextMessage(
        'assistant',
        '## Demo session\nThis record validates every message renderer before a real model is configured.',
      ),
      {
        id: randomUUID(),
        role: 'assistant',
        content: {
          type: 'table',
          title: 'Supplier risk summary',
          columns: [
            { key: 'supplier', label: 'Supplier' },
            { key: 'level', label: 'Level' },
            { key: 'risk', label: 'Risk' },
          ],
          rows: [
            { supplier: 'Nvidia Supplier', level: 'Level 1', risk: 'Low' },
            { supplier: 'Battery Partner', level: 'Level 2', risk: 'Medium' },
          ],
        },
        createdAt: now,
      },
      {
        id: randomUUID(),
        role: 'assistant',
        content: {
          type: 'chart',
          title: 'Companies by level',
          chartType: 'bar',
          labels: ['Level 1', 'Level 2', 'Level 3'],
          datasets: [
            {
              label: 'Companies',
              data: [5, 2, 1],
              backgroundColor: ['#00a76f', '#ffab00', '#637381'],
            },
          ],
        },
        createdAt: now,
      },
      {
        id: randomUUID(),
        role: 'assistant',
        content: {
          type: 'report',
          title: 'Weekly supplier report',
          summary:
            'A preview card for a generated report. Report generation is not orchestrated in this milestone.',
          status: 'draft',
        },
        createdAt: now,
      },
      {
        id: randomUUID(),
        role: 'assistant',
        content: {
          type: 'confirmation',
          title: 'Confirm report export',
          description:
            'This validates the human-confirmation dialog without executing a task.',
          actions: [
            { id: 'approve', label: 'Approve', tone: 'primary' },
            { id: 'cancel', label: 'Cancel', tone: 'neutral' },
          ],
        },
        createdAt: now,
      },
    ];
  }

  private asRecord(value: unknown): JsonRecord {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as JsonRecord;
    }

    return {};
  }

  private readString(record: JsonRecord, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];

      if (value === null || value === undefined) {
        continue;
      }

      if (!['string', 'number', 'boolean', 'bigint'].includes(typeof value)) {
        continue;
      }

      const text = `${value as string | number | boolean | bigint}`.trim();

      if (text) {
        return text;
      }
    }

    return '';
  }

  private readNumber(record: JsonRecord, keys: string[]): number {
    for (const key of keys) {
      const value = record[key];

      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string') {
        const parsed = Number(value.replace(/[$,\s]/g, ''));

        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return 0;
  }

  private readNumberOrNull(record: JsonRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = record[key];

      if (value === null || value === undefined || value === '') {
        continue;
      }

      if (typeof value !== 'number' && typeof value !== 'string') {
        continue;
      }

      const parsed =
        typeof value === 'number'
          ? value
          : Number(value.replace(/[, \s]/g, ''));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  private extractRequestedLevel(
    companies: CompanyView[],
    query: string,
  ): string | null {
    const numberedMatch =
      query.match(/\blevel\s*[-:]?\s*(\d+)\b/i) ??
      query.match(/第?\s*(\d+)\s*(?:级|层)/);

    if (numberedMatch) {
      const requested = 'level' + numberedMatch[1];
      const existing = companies.find(
        (company) => this.normalizeLevel(company.level) === requested,
      );

      return existing?.level || 'Level ' + numberedMatch[1];
    }

    const asksForHighLevel =
      /\bhigh(?:est)?(?:\s+level)?\b/i.test(query) ||
      this.includesAny(query, ['高等级', '高级别', '最高等级', '最高级别']);
    const asksForLowLevel =
      /\blow(?:est)?(?:\s+level)?\b/i.test(query) ||
      this.includesAny(query, ['低等级', '低级别', '最低等级', '最低级别']);

    if (!asksForHighLevel && !asksForLowLevel) {
      return null;
    }

    const numberedLevels = companies
      .map((company) => ({
        label: company.level,
        number: Number(company.level.match(/\d+/)?.[0]),
      }))
      .filter(
        (level): level is { label: string; number: number } =>
          level.label.length > 0 && Number.isFinite(level.number),
      )
      .sort((first, second) => first.number - second.number);

    if (numberedLevels.length > 0) {
      return asksForHighLevel
        ? numberedLevels[numberedLevels.length - 1].label
        : numberedLevels[0].label;
    }

    const namedLevel = asksForHighLevel ? 'high' : 'low';
    return (
      companies.find(
        (company) => this.normalizeLevel(company.level) === namedLevel,
      )?.level ?? null
    );
  }

  private normalizeLevel(value: string): string {
    return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  private includesAny(query: string, keywords: string[]): boolean {
    return keywords.some((keyword) => query.includes(keyword));
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
