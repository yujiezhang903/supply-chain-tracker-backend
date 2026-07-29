const fs = require('node:fs');
const path = require('node:path');

const projectRoot = process.cwd();

function projectPath(relativePath) {
  return path.join(projectRoot, relativePath);
}

function requireFile(relativePath) {
  const absolutePath = projectPath(relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing expected file: ${relativePath}`);
  }

  return absolutePath;
}

function backupFile(relativePath) {
  const sourcePath = requireFile(relativePath);
  const backupPath = `${sourcePath}.before-ollama-adapter`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(sourcePath, backupPath);
  }
}

function readFile(relativePath) {
  return fs
    .readFileSync(requireFile(relativePath), 'utf8')
    .replace(/\r\n/g, '\n');
}

function writeFile(relativePath, content) {
  const absolutePath = projectPath(relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content.replace(/\r\n/g, '\n'), 'utf8');
}

function replaceOnce(content, oldText, newText, label) {
  if (content.includes(newText)) {
    return content;
  }

  const firstIndex = content.indexOf(oldText);

  if (firstIndex === -1) {
    throw new Error(
      `Could not find ${label}. Your source differs from the expected version.`,
    );
  }

  if (content.indexOf(oldText, firstIndex + oldText.length) !== -1) {
    throw new Error(
      `Found more than one ${label}; stopped to avoid an unsafe edit.`,
    );
  }

  return (
    content.slice(0, firstIndex) +
    newText +
    content.slice(firstIndex + oldText.length)
  );
}

function setEnvValues(relativePath, values) {
  const absolutePath = projectPath(relativePath);
  let content = fs.existsSync(absolutePath)
    ? fs.readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n')
    : '';

  for (const [key, value] of Object.entries(values)) {
    const linePattern = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;

    if (linePattern.test(content)) {
      content = content.replace(linePattern, line);
    } else {
      content = `${content.replace(/\s*$/, '')}\n${line}\n`;
    }
  }

  fs.writeFileSync(absolutePath, content.replace(/^\n/, ''), 'utf8');
}

const packageJsonPath = requireFile('package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.name !== 'bknd') {
  throw new Error(
    'Run this script from the backend root: ~/internship-project/bknd',
  );
}

backupFile('src/ai-agent/ai-agent.module.ts');
backupFile('src/ai-agent/ai-agent.service.ts');
backupFile('src/ai-agent/services/ai-chat-sessions.service.ts');

writeFile(
  'src/ai-agent/adapters/model-adapter.interface.ts',
  `export type ModelProvider =
  | 'ollama'
  | 'deepseek'
  | 'qwen'
  | 'openai';

export type ModelMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ModelCompletion = {
  provider: ModelProvider;
  model: string;
  content: string;
};

export interface ModelAdapter {
  complete(messages: ModelMessage[]): Promise<ModelCompletion>;
}
`,
);

writeFile(
  'src/ai-agent/adapters/ollama.adapter.ts',
  `import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  ModelAdapter,
  ModelCompletion,
  ModelMessage,
} from './model-adapter.interface';

type OllamaChatResponse = {
  model?: string;
  message?: {
    role?: string;
    content?: string;
  };
  error?: string;
};

@Injectable()
export class OllamaAdapter implements ModelAdapter {
  constructor(private readonly config: ConfigService) {}

  async complete(
    messages: ModelMessage[],
  ): Promise<ModelCompletion> {
    const baseUrl =
      this.config.get<string>('OLLAMA_BASE_URL') ??
      'http://localhost:11434';
    const model =
      this.config.get<string>('OLLAMA_MODEL') ?? 'qwen3:8b';
    const numCtx =
      Number(this.config.get<string>('OLLAMA_NUM_CTX')) ||
      4096;
    const endpoint =
      baseUrl.replace(/\\/$/, '') + '/api/chat';

    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          think: false,
          options: {
            num_ctx: numCtx,
          },
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Cannot connect to Ollama. Make sure the Ollama app is running.',
      );
    }

    let payload: OllamaChatResponse;

    try {
      payload = (await response.json()) as OllamaChatResponse;
    } catch {
      throw new ServiceUnavailableException(
        'Ollama returned an invalid response.',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        payload.error ||
          \`Ollama request failed with status \${response.status}.\`,
      );
    }

    const content = payload.message?.content?.trim();

    if (!content) {
      throw new ServiceUnavailableException(
        'Ollama returned an empty response.',
      );
    }

    return {
      provider: 'ollama',
      model: payload.model || model,
      content,
    };
  }
}
`,
);

writeFile(
  'src/ai-agent/adapters/openai-compatible.adapter.ts',
  `import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  ModelCompletion,
  ModelMessage,
  ModelProvider,
} from './model-adapter.interface';

type CloudProvider = Exclude<ModelProvider, 'ollama'>;

type ProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  extraBody?: Record<string, unknown>;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

@Injectable()
export class OpenAiCompatibleAdapter {
  constructor(private readonly config: ConfigService) {}

  async complete(
    provider: CloudProvider,
    messages: ModelMessage[],
  ): Promise<ModelCompletion> {
    const providerConfig = this.getProviderConfig(provider);

    if (!providerConfig.apiKey || !providerConfig.model) {
      throw new ServiceUnavailableException(
        \`\${provider} model configuration is incomplete.\`,
      );
    }

    const endpoint =
      providerConfig.baseUrl.replace(/\\/$/, '') +
      '/chat/completions';
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${providerConfig.apiKey}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: providerConfig.model,
          messages,
          stream: false,
          ...providerConfig.extraBody,
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        \`Cannot connect to the \${provider} model service.\`,
      );
    }

    const payload =
      (await response.json()) as ChatCompletionResponse;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        payload.error?.message ||
          \`\${provider} request failed with status \${response.status}.\`,
      );
    }

    const content =
      payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new ServiceUnavailableException(
        \`\${provider} returned an empty response.\`,
      );
    }

    return {
      provider,
      model: providerConfig.model,
      content,
    };
  }

  private getProviderConfig(
    provider: CloudProvider,
  ): ProviderConfig {
    if (provider === 'deepseek') {
      return {
        apiKey:
          this.config.get<string>('DEEPSEEK_API_KEY') ?? '',
        baseUrl:
          this.config.get<string>('DEEPSEEK_BASE_URL') ??
          'https://api.deepseek.com',
        model:
          this.config.get<string>('DEEPSEEK_MODEL') ?? '',
      };
    }

    if (provider === 'qwen') {
      return {
        apiKey:
          this.config.get<string>('DASHSCOPE_API_KEY') ?? '',
        baseUrl:
          this.config.get<string>('QWEN_BASE_URL') ??
          'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: this.config.get<string>('QWEN_MODEL') ?? '',
        extraBody: {
          enable_thinking: false,
        },
      };
    }

    return {
      apiKey:
        this.config.get<string>('OPENAI_API_KEY') ?? '',
      baseUrl:
        this.config.get<string>('OPENAI_BASE_URL') ??
        'https://api.openai.com/v1',
      model: this.config.get<string>('OPENAI_MODEL') ?? '',
    };
  }
}
`,
);

writeFile(
  'src/ai-agent/adapters/ai-model-router.service.ts',
  `import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  ModelCompletion,
  ModelMessage,
  ModelProvider,
} from './model-adapter.interface';
import { OllamaAdapter } from './ollama.adapter';
import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';

const MODEL_PROVIDERS: ModelProvider[] = [
  'ollama',
  'deepseek',
  'qwen',
  'openai',
];

@Injectable()
export class AiModelRouterService {
  constructor(
    private readonly config: ConfigService,
    private readonly ollamaAdapter: OllamaAdapter,
    private readonly cloudAdapter: OpenAiCompatibleAdapter,
  ) {}

  complete(
    messages: ModelMessage[],
  ): Promise<ModelCompletion> {
    const provider = this.getProvider();

    if (provider === 'ollama') {
      return this.ollamaAdapter.complete(messages);
    }

    return this.cloudAdapter.complete(provider, messages);
  }

  private getProvider(): ModelProvider {
    const configuredProvider = (
      this.config.get<string>('AI_MODEL_PROVIDER') ??
      'ollama'
    ).toLowerCase();

    if (
      !MODEL_PROVIDERS.includes(
        configuredProvider as ModelProvider,
      )
    ) {
      throw new BadRequestException(
        \`Unsupported AI_MODEL_PROVIDER: \${configuredProvider}\`,
      );
    }

    return configuredProvider as ModelProvider;
  }
}
`,
);

let moduleSource = readFile('src/ai-agent/ai-agent.module.ts');

moduleSource = replaceOnce(
  moduleSource,
  `import { AiAgentService } from './ai-agent.service';
import { AiChatSession } from './entities/ai-chat-session.entity';`,
  `import { AiAgentService } from './ai-agent.service';
import { AiModelRouterService } from './adapters/ai-model-router.service';
import { OllamaAdapter } from './adapters/ollama.adapter';
import { OpenAiCompatibleAdapter } from './adapters/openai-compatible.adapter';
import { AiChatSession } from './entities/ai-chat-session.entity';`,
  'AI Agent module imports',
);

moduleSource = replaceOnce(
  moduleSource,
  `    AiAgentService,
    AiChatSessionsService,`,
  `    AiAgentService,
    AiChatSessionsService,
    AiModelRouterService,
    OllamaAdapter,
    OpenAiCompatibleAdapter,`,
  'AI Agent module providers',
);

writeFile('src/ai-agent/ai-agent.module.ts', moduleSource);

let serviceSource = readFile('src/ai-agent/ai-agent.service.ts');

serviceSource = replaceOnce(
  serviceSource,
  `import { CompaniesService } from '../companies/companies.service';
import { ChatRequestDto } from './dto/chat-request.dto';`,
  `import { CompaniesService } from '../companies/companies.service';
import { AiModelRouterService } from './adapters/ai-model-router.service';
import type { ModelMessage } from './adapters/model-adapter.interface';
import { ChatRequestDto } from './dto/chat-request.dto';`,
  'AI Agent service imports',
);

serviceSource = replaceOnce(
  serviceSource,
  `    private readonly companiesService: CompaniesService,
    private readonly sessionsService: AiChatSessionsService,`,
  `    private readonly companiesService: CompaniesService,
    private readonly sessionsService: AiChatSessionsService,
    private readonly modelRouter: AiModelRouterService,`,
  'AI Agent service constructor',
);

serviceSource = replaceOnce(
  serviceSource,
  `    const assistantMessages =
      this.createReplyMessages(companies, query);

    await this.sessionsService.appendMessages(
      session.id,
      [
        userMessage,
        ...assistantMessages,
      ],
    );

    return {
      sessionId: session.id,
      messages: assistantMessages,
    };`,
  `    const ruleMessages =
      this.createReplyMessages(companies, query);

    let assistantMessages: AiChatMessage[];
    let provider = 'rules';
    let model = 'rule-based';

    if (ruleMessages) {
      assistantMessages = ruleMessages;
    } else {
      const completion = await this.modelRouter.complete(
        this.createModelMessages(
          session.messages ?? [],
          request.message.trim(),
          companies,
        ),
      );

      provider = completion.provider;
      model = completion.model;
      assistantMessages = [
        this.createTextMessage(
          'assistant',
          completion.content,
        ),
      ];
    }

    await this.sessionsService.appendMessages(
      session.id,
      [
        userMessage,
        ...assistantMessages,
      ],
      model,
    );

    return {
      sessionId: session.id,
      provider,
      model,
      messages: assistantMessages,
    };`,
  'AI Agent chat reply block',
);

serviceSource = replaceOnce(
  serviceSource,
  `  ): AiChatMessage[] {
    if (`,
  `  ): AiChatMessage[] | null {
    if (`,
  'createReplyMessages return type',
);

serviceSource = replaceOnce(
  serviceSource,
  `    const countries = new Set(
      companies
        .map((company) => company.country?.trim())
        .filter(Boolean),
    );

    const levels = new Set(
      companies
        .map((company) => company.level?.trim())
        .filter(Boolean),
    );

    return [
      this.createTextMessage(
        'assistant',
        [
          \`The database currently contains **\${companies.length} companies** across **\${countries.size} countries** and **\${levels.size} levels**.\`,
          '',
          'You can ask me to:',
          '',
          '- Show the number of companies',
          '- Compare company levels',
          '- Show the country distribution',
          '- Rank companies by annual revenue',
          '- Rank companies by employee count',
          '- List companies',
        ].join('\\n'),
      ),
    ];`,
  `    return null;`,
  'rule-based fallback response',
);

serviceSource = replaceOnce(
  serviceSource,
  `  private createTextMessage(
    role: AiChatMessageRole,`,
  `  private createModelMessages(
    history: AiChatMessage[],
    userInput: string,
    companies: CompanyView[],
  ): ModelMessage[] {
    const countries = new Set(
      companies
        .map((company) => company.country?.trim())
        .filter(Boolean),
    );
    const levels = new Set(
      companies
        .map((company) => company.level?.trim())
        .filter(Boolean),
    );
    const messages: ModelMessage[] = [
      {
        role: 'system',
        content: [
          'You are the AI assistant inside a supply-chain tracking dashboard.',
          'Reply in the same language as the user.',
          'Give concise, practical answers and use Markdown when useful.',
          'Do not claim that you changed database data.',
          \`Current database snapshot: \${companies.length} companies, \${countries.size} countries, \${levels.size} levels.\`,
        ].join(' '),
      },
    ];

    for (const message of history.slice(-20)) {
      if (message.type !== 'text') {
        continue;
      }

      messages.push({
        role: message.role,
        content: message.content.markdown,
      });
    }

    messages.push({
      role: 'user',
      content: userInput,
    });

    return messages;
  }

  private createTextMessage(
    role: AiChatMessageRole,`,
  'model message conversion method',
);

writeFile('src/ai-agent/ai-agent.service.ts', serviceSource);

let sessionsSource = readFile(
  'src/ai-agent/services/ai-chat-sessions.service.ts',
);

sessionsSource = replaceOnce(
  sessionsSource,
  `  async appendMessages(
    sessionId: string,
    messages: AiChatMessage[],
  ) {`,
  `  async appendMessages(
    sessionId: string,
    messages: AiChatMessage[],
    model?: string,
  ) {`,
  'appendMessages parameters',
);

sessionsSource = replaceOnce(
  sessionsSource,
  `    session.messages = [
      ...(session.messages ?? []),
      ...messages,
    ];

    return this.sessionsRepository.save(session);`,
  `    session.messages = [
      ...(session.messages ?? []),
      ...messages,
    ];

    if (model) {
      session.model = model;
    }

    return this.sessionsRepository.save(session);`,
  'session model update',
);

writeFile(
  'src/ai-agent/services/ai-chat-sessions.service.ts',
  sessionsSource,
);

const ollamaEnv = {
  AI_MODEL_PROVIDER: 'ollama',
  OLLAMA_BASE_URL: 'http://localhost:11434',
  OLLAMA_MODEL: 'qwen3:8b',
  OLLAMA_NUM_CTX: '4096',
};

setEnvValues('.env', ollamaEnv);

if (fs.existsSync(projectPath('.env.example'))) {
  setEnvValues('.env.example', ollamaEnv);
}

console.log('Ollama AI adapter files created.');
console.log('Existing AI Agent files backed up with .before-ollama-adapter.');
console.log('Updated .env to use qwen3:8b through Ollama.');
console.log('Next: run npx prettier --write and npx tsc --noEmit.');