const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function projectPath(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  const filePath = projectPath(relativePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${relativePath}`);
  }

  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function write(relativePath, content) {
  const filePath = projectPath(relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.replace(/\r\n/g, '\n'), 'utf8');
}

function backup(relativePath) {
  const source = projectPath(relativePath);
  const target = `${source}.before-ai-agent-fix`;

  if (fs.existsSync(source) && !fs.existsSync(target)) {
    fs.copyFileSync(source, target);
  }
}

function replaceOnce(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Could not find ${label}. The file differs from the expected project version.`);
  }

  return content.replace(pattern, replacement);
}

const entityPath = 'src/ai-agent/entities/ai-chat-session.entity.ts';
const sessionsPath =
  'src/ai-agent/services/ai-chat-sessions.service.ts';
const interfacePath =
  'src/ai-agent/adapters/model-adapter.interface.ts';
const ollamaPath = 'src/ai-agent/adapters/ollama.adapter.ts';

for (const file of [entityPath, sessionsPath]) {
  backup(file);
}

let entity = read(entityPath);

if (!/\bmodel!\s*:/.test(entity)) {
  entity = replaceOnce(
    entity,
    /(\n\s*title!\s*:\s*string;\r?\n)/,
    `$1\n  @Column({ default: 'rule-based' })\n  model!: string;\n\n  @Column({ default: 'active' })\n  status!: string;\n`,
    'AiChatSession.title',
  );
}

if (!/\bstatus!\s*:/.test(entity)) {
  entity = replaceOnce(
    entity,
    /(\n\s*model!\s*:\s*string;\r?\n)/,
    `$1\n  @Column({ default: 'active' })\n  status!: string;\n`,
    'AiChatSession.model',
  );
}

write(entityPath, entity);

write(
  interfacePath,
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

write(
  ollamaPath,
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
      Number(this.config.get<string>('OLLAMA_NUM_CTX')) || 4096;
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

let sessions = read(sessionsPath);

if (!/messages: AiChatMessage\[\],\s*\n\s*model\?: string/.test(sessions)) {
  sessions = replaceOnce(
    sessions,
    /(async appendMessages\(\s*\n\s*sessionId: string,\s*\n\s*messages: AiChatMessage\[\],?)(\s*\n\s*\))/m,
    `$1\n    model?: string,$2`,
    'appendMessages parameters',
  );
}

if (!/if \(model\)\s*\{\s*session\.model = model;/.test(sessions)) {
  sessions = replaceOnce(
    sessions,
    /(\n\s*session\.messages = \[\s*\n\s*\.\.\.\(session\.messages \?\? \[\]\),\s*\n\s*\.\.\.messages,\s*\n\s*\];\s*\n)(\s*\n\s*return this\.sessionsRepository\.save\(session\);)/m,
    `$1\n    if (model) {\n      session.model = model;\n    }$2`,
    'session message persistence',
  );
}

write(sessionsPath, sessions);

console.log('AI Agent compatibility repair completed.');
console.log('Backups were created with the suffix .before-ai-agent-fix.');
console.log('Next: run npx tsc --noEmit and npm run build.');
