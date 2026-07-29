const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  const filePath = absolute(relativePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${relativePath}`);
  }

  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function write(relativePath, content) {
  const filePath = absolute(relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.replace(/\r\n/g, '\n'), 'utf8');
}

function backup(relativePath) {
  const source = absolute(relativePath);
  const target = `${source}.before-ai-agent-final-fix`;

  if (fs.existsSync(source) && !fs.existsSync(target)) {
    fs.copyFileSync(source, target);
  }
}

function replaceOnce(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Could not find ${label}. The file differs from the expected version.`);
  }

  return content.replace(pattern, replacement);
}

const packageJsonPath = absolute('package.json');

if (!fs.existsSync(packageJsonPath)) {
  throw new Error('Run this script from the backend root, for example ~/internship-project/bknd.');
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.name !== 'bknd') {
  throw new Error('This does not look like the bknd backend. Stop without changing files.');
}

const entityPath = 'src/ai-agent/entities/ai-chat-session.entity.ts';
const sessionsPath = 'src/ai-agent/services/ai-chat-sessions.service.ts';
const interfacePath = 'src/ai-agent/adapters/model-adapter.interface.ts';
const ollamaPath = 'src/ai-agent/adapters/ollama.adapter.ts';
const servicePath = 'src/ai-agent/ai-agent.service.ts';
const compatiblePath = 'src/ai-agent/adapters/openai-compatible.adapter.ts';

for (const file of [
  entityPath,
  sessionsPath,
  interfacePath,
  ollamaPath,
  servicePath,
  compatiblePath,
]) {
  if (fs.existsSync(absolute(file))) {
    backup(file);
  }
}

let entity = read(entityPath);

if (!/\bmodel!\s*:\s*string/.test(entity)) {
  entity = replaceOnce(
    entity,
    /(\n\s*title!\s*:\s*string;\s*\n)/,
    `$1\n  @Column({ default: 'rule-based' })\n  model!: string;\n`,
    'AiChatSession.title',
  );
}

if (!/\bstatus!\s*:\s*string/.test(entity)) {
  entity = replaceOnce(
    entity,
    /(\n\s*model!\s*:\s*string;\s*\n)/,
    `$1\n  @Column({ default: 'active' })\n  status!: string;\n`,
    'AiChatSession.model',
  );
}

write(entityPath, entity);

// The existing adapters use ModelCompletion.text. Keep one shared adapter
// contract, but allow the newly added Ollama provider as well.
write(
  interfacePath,
  `import type {
  ModelCompletion as ExistingModelCompletion,
  ModelMessage as ExistingModelMessage,
} from '../types/chat-message.type';

export type ModelMessage = ExistingModelMessage;

export type ModelProvider =
  | ExistingModelCompletion['provider']
  | 'ollama';

export type ModelCompletion = {
  provider: ModelProvider;
  model: string;
  text: string;
};

export interface ModelAdapter {
  complete(messages: ModelMessage[]): Promise<ModelCompletion>;
}
`,
);

// The Ollama response calls its text "content", but the application-level
// completion contract calls the same value "text".
let ollama = read(ollamaPath);
ollama = ollama.replace(
  /(\n\s*)content,(\s*\n\s*\};?\s*\n)/,
  '$1text: content,$2',
);
write(ollamaPath, ollama);

// The previous adapter script may have written content in this return object.
// Change only the returned completion field, not request/response content fields.
if (fs.existsSync(absolute(compatiblePath))) {
  let compatible = read(compatiblePath);
  compatible = compatible.replace(
    /(return\s*\{[\s\S]*?provider\s*:[\s\S]*?model\s*:[^,\n]+,\s*)content,\s*\n\s*\};/m,
    '$1text: content,\n    };',
  );
  write(compatiblePath, compatible);
}

// The model adapters and the shared contract now expose completion.text.
if (fs.existsSync(absolute(servicePath))) {
  let service = read(servicePath);
  service = service.replace(/completion\.content/g, 'completion.text');
  write(servicePath, service);
}

let sessions = read(sessionsPath);

if (
  !/async appendMessages\([\s\S]*?messages:\s*AiChatMessage\[\],\s*model\?:\s*string,?[\s\S]*?\)/m.test(
    sessions,
  )
) {
  sessions = replaceOnce(
    sessions,
    /(async appendMessages\(\s*\n\s*sessionId:\s*string,\s*\n\s*messages:\s*AiChatMessage\[\],?)(\s*\n\s*\))/m,
    '$1\n    model?: string,$2',
    'appendMessages parameters',
  );
}

if (!/if \(model\)\s*\{\s*session\.model\s*=\s*model;/.test(sessions)) {
  sessions = replaceOnce(
    sessions,
    /(\n\s*session\.messages\s*=\s*\[\s*\n\s*\.\.\.\(session\.messages\s*\?\?\s*\[\]\),\s*\n\s*\.\.\.messages,\s*\n\s*\];\s*\n)(\s*\n\s*return this\.sessionsRepository\.save\(session\);)/m,
    '$1\n    if (model) {\n      session.model = model;\n    }$2',
    'session model persistence',
  );
}

write(sessionsPath, sessions);

console.log('AI Agent final compatibility repair completed.');
console.log('Backups use the suffix .before-ai-agent-final-fix.');
console.log('Run npx tsc --noEmit and npm run build next.');
