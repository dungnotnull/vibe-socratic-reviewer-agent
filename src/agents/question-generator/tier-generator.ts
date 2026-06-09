import { BlindSpot, SocraticQuestion, QuestionTier } from '../../types';
import { loadQuestionTemplates } from '../../tools/config-loader';
import { llmClient } from '../../tools/llm-client';
import * as fs from 'fs';
import * as path from 'path';

export class QuestionGenerator {
  private templates: Record<string, { tier1: string[]; tier2: string[]; tier3: string[] }>;
  private questionCounter: number;
  private usedQuestions: Set<string>;

  constructor() {
    this.templates = loadQuestionTemplates();
    this.questionCounter = 0;
    this.usedQuestions = new Set();
  }

  async generate(blindSpots: BlindSpot[], requestDescription: string): Promise<SocraticQuestion[]> {
    if (blindSpots.length === 0) return [];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      return this.generateWithLLM(blindSpots, requestDescription);
    }

    return this.generateFromTemplates(blindSpots, requestDescription);
  }

  private async generateWithLLM(blindSpots: BlindSpot[], requestDescription: string): Promise<SocraticQuestion[]> {
    const systemPrompt = fs.readFileSync(
      path.join(__dirname, '..', '..', 'prompts', 'question-generation-prompt.md'),
      'utf8'
    );

    const filledPrompt = systemPrompt
      .replace('{request_description}', requestDescription)
      .replace('{blind_spots}', blindSpots.map(b => `- [${b.severity}] ${b.type}: ${b.description}`).join('\n'));

    const response = await llmClient.complete(filledPrompt, 'Generate 3 Socratic questions', { temperature: 0.7 });

    try {
      const parsed = JSON.parse(response.text);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return parsed.questions.slice(0, 3).map((q: any, idx: number) => ({
          id: `q-${++this.questionCounter}`,
          tier: (['tier3', 'tier2', 'tier1'][idx] as QuestionTier),
          text: q.text ?? q.question ?? '',
          blindSpotType: blindSpots[idx]?.type ?? 'unknown',
          conceptTested: blindSpots[idx]?.category ?? 'unknown',
          specificityScore: this.calculateSpecificity(q.text ?? '', requestDescription),
        }));
      }
    } catch {
      // Fall back to templates on parse error
    }

    return this.generateFromTemplates(blindSpots, requestDescription);
  }

  private generateFromTemplates(blindSpots: BlindSpot[], requestDescription: string): SocraticQuestion[] {
    const questions: SocraticQuestion[] = [];

    for (let i = 0; i < blindSpots.length && questions.length < 3; i++) {
      const bs = blindSpots[i];
      const tier: QuestionTier = ['tier3', 'tier2', 'tier1'][questions.length] as QuestionTier;
      const categoryTemplates = this.templates[bs.type];

      let text = this.pickQuestion(categoryTemplates, tier, bs);
      if (this.usedQuestions.has(text)) {
        text = this.pickQuestion(categoryTemplates, tier, bs);
      }
      this.usedQuestions.add(text);

      questions.push({
        id: `q-${++this.questionCounter}`,
        tier,
        text,
        blindSpotType: bs.type,
        conceptTested: bs.category,
        specificityScore: this.calculateSpecificity(text, requestDescription),
      });
    }

    return questions;
  }

  private pickQuestion(
    templates: { tier1: string[]; tier2: string[]; tier3: string[] } | undefined,
    tier: QuestionTier,
    bs: BlindSpot
  ): string {
    if (templates && templates[tier] && templates[tier].length > 0) {
      const unused = templates[tier].filter(t => !this.usedQuestions.has(t));
      const pool = unused.length > 0 ? unused : templates[tier];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    const fallbacks: Record<QuestionTier, string[]> = {
      tier3: [
        `Nếu 2 request gọi hàm này cùng lúc, điều gì xảy ra với dữ liệu?`,
        `Trong production với concurrent requests, ${bs.type} này có thể fail thế nào?`,
      ],
      tier2: [
        `Tại sao bạn chọn cách này cho ${bs.type}? Có alternative nào đáng cân nhắc không?`,
        `Design choice này ảnh hưởng gì đến khả năng mở rộng sau này?`,
      ],
      tier1: [
        `Bạn đã nghĩ đến edge case nào cho ${bs.type} trong ngữ cảnh này chưa?`,
        `Khi dữ liệu đầu vào không như mong đợi, code này sẽ xử lý ra sao?`,
      ],
    };

    const pool = fallbacks[tier];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  calculateSpecificity(question: string, requestDescription: string): number {
    const requestWords = new Set(
      requestDescription.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );
    const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = questionWords.filter(w => requestWords.has(w)).length;
    const specificity = Math.min(5, Math.round((overlap / Math.max(1, questionWords.length)) * 10 + 1));
    const isGeneric = /do you understand|bạn có hiểu|what is|định nghĩa/i.test(question);

    return isGeneric ? 1 : specificity;
  }
}
