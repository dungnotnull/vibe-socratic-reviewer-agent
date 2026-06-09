import { logger } from './logger';

export interface LlmResponse {
  text: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
}

interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

let missingKeyWarned = false;

export class LlmClient {
  private apiKey: string | null;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY ?? null;
    this.baseUrl = 'https://api.anthropic.com/v1';

    if (!this.apiKey && !missingKeyWarned) {
      missingKeyWarned = true;
      logger.warn('ANTHROPIC_API_KEY not set — LLM calls will use stub responses. Set ANTHROPIC_API_KEY to enable AI-powered question generation, answer evaluation, and code annotation.');
    }
  }

  async complete(systemPrompt: string, userMessage: string, options: LlmOptions = {}): Promise<LlmResponse> {
    const apiKey = this.apiKey;
    const { temperature = 0.7, maxTokens = 4096 } = options;

    if (!apiKey) {
      return this.stubResponse(systemPrompt, userMessage);
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json() as any;
    return {
      text: data.content?.[0]?.text ?? '',
      model: data.model ?? 'unknown',
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
      },
    };
  }

  private stubResponse(systemPrompt: string, userMessage: string): LlmResponse {
    const isQuestionGen = /question.*generat|blind.*spot|Socratic/i.test(systemPrompt + userMessage);
    const isEval = /evaluate.*answer|understanding.*level|scoring/i.test(systemPrompt + userMessage);
    const isAnnotate = /annotate|annotation|WHY:|RISK:|CONSIDER:|DANGER:/i.test(systemPrompt + userMessage);
    const isTeach = /teach|concept|explain|dạy/i.test(systemPrompt + userMessage);

    if (isQuestionGen) {
      return {
        text: JSON.stringify({ questions: [] }),
        model: 'stub',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    }
    if (isEval) {
      return {
        text: JSON.stringify({ understandingLevel: 'ADEQUATE', keyInsightPresent: true, keyInsightMissing: '' }),
        model: 'stub',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    }
    if (isAnnotate) {
      return {
        text: userMessage,
        model: 'stub',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    }
    if (isTeach) {
      return {
        text: 'Đây là một concept quan trọng. Khi LLM được kết nối, tôi sẽ giải thích chi tiết hơn.',
        model: 'stub',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    }

    return {
      text: JSON.stringify({ result: 'ok' }),
      model: 'stub',
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }
}

export const llmClient = new LlmClient();
