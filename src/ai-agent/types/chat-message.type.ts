import type { AiProvider } from './ai-provider.type';

export type ChatRole = 'user' | 'assistant';

export type ChatAttachment = {
  name: string;
  mimeType: string;
  size: number;
};

export type TextMessageContent = {
  type: 'text';
  text: string;
};

export type TableMessageContent = {
  type: 'table';
  title?: string;
  columns: Array<{
    key: string;
    label: string;
  }>;
  rows: Array<Record<string, string | number | boolean | null>>;
};

export type ChartMessageContent = {
  type: 'chart';
  title: string;
  chartType: 'bar' | 'line' | 'pie';
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }>;
};

export type ReportMessageContent = {
  type: 'report';
  title: string;
  summary: string;
  status: 'draft' | 'ready' | 'failed';
  url?: string;
};

export type ConfirmationMessageContent = {
  type: 'confirmation';
  title: string;
  description: string;
  actions: Array<{
    id: string;
    label: string;
    tone?: 'primary' | 'danger' | 'neutral';
  }>;
};

export type ChatMessageContent =
  | TextMessageContent
  | TableMessageContent
  | ChartMessageContent
  | ReportMessageContent
  | ConfirmationMessageContent;

export type AiChatMessage = {
  id: string;
  role: ChatRole;
  content: ChatMessageContent;
  attachments?: ChatAttachment[];
  createdAt: string;
};

export type ModelMessage = {
  role: 'system' | ChatRole;
  content: string;
};

export type ModelCompletion = {
  provider: AiProvider;
  model: string;
  text: string;
};
