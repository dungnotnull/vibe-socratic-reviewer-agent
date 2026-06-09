import { AnswerEvaluation, UnderstandingLevel } from '../../types';
import { SocraticQuestion } from '../../types';
import { llmClient } from '../../tools/llm-client';
import * as fs from 'fs';
import * as path from 'path';

export class AnswerEvaluator {
  async evaluate(question: SocraticQuestion, answer: string): Promise<AnswerEvaluation> {
    if (this.isDeflecting(answer)) {
      return {
        question,
        developerAnswer: answer,
        understandingLevel: 'DEFLECTING',
        keyInsightPresent: false,
        keyInsightMissing: question.conceptTested,
      };
    }

    if (this.isDontKnow(answer)) {
      return {
        question,
        developerAnswer: answer,
        understandingLevel: 'MISSING',
        keyInsightPresent: false,
        keyInsightMissing: question.conceptTested,
      };
    }

    if (process.env.ANTHROPIC_API_KEY) {
      return this.evaluateWithLLM(question, answer);
    }

    return this.evaluateHeuristic(question, answer);
  }

  private isDeflecting(answer: string): boolean {
    const deflectPatterns = [
      /cho\s+(tôi|t)\s+code\s+đi/i,
      /just\s+give\s+me\s+the\s+code/i,
      /tôi\s+sẽ\s+xem\s+sau/i,
      /không\s+cần\s+hỏi/i,
      /bỏ\s+qua/i,
      /skip/i,
      /tôi\s+biết\s+rồi/i,
      /không\s+liên\s+quan/i,
      /không\s+quan\s+trọng/i,
    ];
    return deflectPatterns.some(p => p.test(answer));
  }

  private isDontKnow(answer: string): boolean {
    const dkPatterns = [
      /tôi\s+không\s+biết/i,
      /không\s+biết/i,
      /chưa\s+nghĩ\s+đến/i,
      /i\s+don.?t\s+know/i,
      /chịu/i,
      /không\s+rõ/i,
      /không\s+chắc/i,
    ];
    return dkPatterns.some(p => p.test(answer));
  }

  private async evaluateWithLLM(question: SocraticQuestion, answer: string): Promise<AnswerEvaluation> {
    const evalPrompt = fs.readFileSync(
      path.join(__dirname, '..', '..', 'prompts', 'answer-evaluation-prompt.md'),
      'utf8'
    );

    const filled = evalPrompt
      .replace('{question_text}', question.text)
      .replace('{blind_spot_type}', question.blindSpotType)
      .replace('{concept_tested}', question.conceptTested)
      .replace('{developer_answer}', answer);

    const response = await llmClient.complete(filled, 'Evaluate answer', { temperature: 0.3 });

    try {
      const jsonStr = this.extractJson(response.text);
      const parsed = JSON.parse(jsonStr);
      return {
        question,
        developerAnswer: answer,
        understandingLevel: this.normalizeLevel(parsed.understandingLevel),
        keyInsightPresent: parsed.keyInsightPresent ?? false,
        keyInsightMissing: parsed.keyInsightMissing ?? '',
        followUpQuestion: parsed.followUpQuestion,
      };
    } catch {
      return this.evaluateHeuristic(question, answer);
    }
  }

  private extractJson(text: string): string {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : text;
  }

  private normalizeLevel(level: string): UnderstandingLevel {
    const valid: UnderstandingLevel[] = ['DEEP', 'ADEQUATE', 'PARTIAL', 'SURFACE', 'MISSING', 'DEFLECTING'];
    const upper = level?.toUpperCase() ?? '';
    return valid.includes(upper as UnderstandingLevel) ? (upper as UnderstandingLevel) : 'ADEQUATE';
  }

  private evaluateHeuristic(question: SocraticQuestion, answer: string): AnswerEvaluation {
    const length = answer.length;
    const hasSpecificDetail = /transaction|lock|parameterize|idempoten|optimistic|pessimistic|rollback|commit|atomic|Promise\.all|authorization|validation|sanitize|giao dịch|khóa|tham số|bất biến|nguyên tử|cần|phải|đảm bảo|tránh|UUID|key|client|server|xử lý|transaction|rollback|idempotency/i.test(answer);
    const hasDeeperThinking = /vì|bởi vì|do đó|nên|sẽ|khi đó|trong trường hợp|nếu như|giả sử|bởi lẽ|ngoài ra|cần thêm|đảm bảo|cùng thành công|cùng thất bại|nếu|cách làm|giải pháp/i.test(answer);
    const hasCodeExample = /[{}()[\]]|```|SELECT|INSERT|UPDATE|DELETE|\.then\(|async|await|Promise|try|catch/i.test(answer);

    let understandingLevel: UnderstandingLevel;
    let keyInsightPresent = false;

    if (hasSpecificDetail && (hasDeeperThinking || hasCodeExample) && length > 100) {
      understandingLevel = 'DEEP';
      keyInsightPresent = true;
    } else if (hasSpecificDetail && length > 40) {
      understandingLevel = 'ADEQUATE';
      keyInsightPresent = true;
    } else if (length > 40 && hasDeeperThinking) {
      understandingLevel = 'PARTIAL';
      keyInsightPresent = false;
    } else if (length > 20) {
      understandingLevel = 'SURFACE';
      keyInsightPresent = false;
    } else {
      understandingLevel = 'SURFACE';
      keyInsightPresent = false;
    }

    return {
      question,
      developerAnswer: answer,
      understandingLevel,
      keyInsightPresent,
      keyInsightMissing: keyInsightPresent ? '' : question.conceptTested,
    };
  }
}
