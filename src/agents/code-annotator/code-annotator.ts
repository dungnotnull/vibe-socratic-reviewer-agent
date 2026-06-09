import { AnnotatedCode, CodeAnnotation } from '../../types';
import { llmClient } from '../../tools/llm-client';
import * as fs from 'fs';
import * as path from 'path';

const COMMENT_SYNTAX: Record<string, { single: string; open: string; close: string }> = {
  typescript: { single: '//', open: '/*', close: '*/' },
  javascript: { single: '//', open: '/*', close: '*/' },
  python: { single: '#', open: '"""', close: '"""' },
  go: { single: '//', open: '/*', close: '*/' },
  java: { single: '//', open: '/*', close: '*/' },
  unknown: { single: '//', open: '/*', close: '*/' },
};

const ANNOTATION_LABELS: Record<string, string> = {
  WHY: 'Vì sao',
  RISK: 'Rủi ro',
  CONSIDER: 'Cân nhắc',
  DANGER: 'Nguy hiểm',
};

export class CodeAnnotator {
  async annotate(code: string, language: string, mode: 'full' | 'minimal' = 'full'): Promise<AnnotatedCode> {
    if (!code || code.trim().length === 0) {
      return { originalCode: code, language, annotations: [] };
    }

    if (process.env.ANTHROPIC_API_KEY && mode === 'full') {
      return this.annotateWithLLM(code, language);
    }

    return this.annotateHeuristic(code, language, mode);
  }

  async annotateAndInsert(code: string, language: string, mode: 'full' | 'minimal' = 'full'): Promise<string> {
    const result = await this.annotate(code, language, mode);
    const comment = COMMENT_SYNTAX[language] ?? COMMENT_SYNTAX.unknown;
    const lines = result.originalCode.split('\n');
    const annotationMap = new Map<number, CodeAnnotation[]>();

    for (const ann of result.annotations) {
      const lineIdx = ann.line - 1;
      if (!annotationMap.has(lineIdx)) annotationMap.set(lineIdx, []);
      annotationMap.get(lineIdx)!.push(ann);
    }

    const output: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const anns = annotationMap.get(i);
      if (anns) {
        for (const ann of anns) {
          const label = ANNOTATION_LABELS[ann.type] ?? ann.type;
          output.push(`${comment.single} ${label}: ${ann.message}`);
        }
      }
      output.push(lines[i]);
    }

    return output.join('\n');
  }

  private async annotateWithLLM(code: string, language: string): Promise<AnnotatedCode> {
    const annotationPrompt = fs.readFileSync(
      path.join(__dirname, '..', '..', 'prompts', 'code-annotation-prompt.md'),
      'utf8'
    );

    const filled = annotationPrompt.replace('{language}', language).replace('{code}', code);
    const response = await llmClient.complete(filled, 'Annotate code', { maxTokens: 8192 });

    const annotations = this.parseAnnotationsFromResponse(code, language);
    if (annotations.length === 0) {
      const llmAnnotations = this.extractAnnotationsFromText(response.text, code);
      if (llmAnnotations.length > 0) return { originalCode: code, language, annotations: llmAnnotations };
    }

    return { originalCode: code, language, annotations };
  }

  private annotateHeuristic(code: string, language: string, mode: string): AnnotatedCode {
    const annotations: CodeAnnotation[] = [];
    const lines = code.split('\n');
    const fullText = lines.join(' ');
    const minDensity = 1;
    const maxDensityPerLine = 0.2;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      if (!line || this.isComment(line, language)) continue;

      if (this.isSqlInjection(line)) {
        annotations.push({ line: lineNum, type: 'DANGER', message: 'Query có thể dính SQL injection. Dùng parameterized query hoặc ORM.' });
      }

      if (this.isSilentErrorCatch(line, lines, i)) {
        annotations.push({ line: lineNum, type: 'RISK', message: 'Catch block có thể nuốt error — caller sẽ không biết lỗi đã xảy ra.' });
      }

      if (this.isBalanceWithoutTransaction(line, fullText)) {
        annotations.push({ line: lineNum, type: 'RISK', message: 'Cập nhật số dư/tồn kho mà không có transaction hoặc lock. Race condition risk.' });
      }

      if (this.isSequentialAwaitOpportunity(line, lines, i)) {
        annotations.push({ line: lineNum, type: 'CONSIDER', message: 'Các await này có vẻ độc lập — có thể dùng Promise.all để tăng tốc.' });
      }

      if (this.isMissingNullCheck(line)) {
        annotations.push({ line: lineNum, type: 'RISK', message: 'Giá trị có thể null/undefined — cần null check trước khi dùng.' });
      }

      if (this.isHardcodedSecret(line)) {
        annotations.push({ line: lineNum, type: 'DANGER', message: 'Secret hardcoded — phải dùng biến môi trường hoặc secret manager.' });
      }
    }

    if (mode === 'full') {
      const maxAnnotations = Math.floor(lines.length * maxDensityPerLine);
      return { originalCode: code, language, annotations: annotations.slice(0, Math.max(minDensity, maxAnnotations)) };
    }

    return { originalCode: code, language, annotations: annotations.slice(0, 2) };
  }

  private isSqlInjection(line: string): boolean {
    return /\.(find|query|execute|raw)\s*\(\s*[`'"]/.test(line) &&
      /(\$\(|\$\{|`\s*\+|['"]\s*\+)/.test(line) &&
      !/parameterized?|prepared|placeholder|\?|:\w+/.test(line);
  }

  private isSilentErrorCatch(line: string, lines: string[], idx: number): boolean {
    if (!line.includes('catch')) return false;
    const block = lines.slice(idx, idx + 8).join(' ');
    return !/(throw|reject|logger\.(error|warn)|reportError|sentry|datadog)/i.test(block) && !/error\.message|error\.stack/.test(block);
  }

  private isBalanceWithoutTransaction(line: string, fullText: string): boolean {
    return /(balance|amount|inventory|stock|quỹ|tồn)\s*(=|-=|\+=)/.test(line) &&
      !/(transaction|lock|select.*for\s+update|optimistic|pessimistic)/i.test(fullText);
  }

  private isSequentialAwaitOpportunity(line: string, lines: string[], idx: number): boolean {
    if (!line.includes('await')) return false;
    const context = lines.slice(idx, idx + 5);
    const awaitCount = context.filter(l => l.includes('await')).length;
    return awaitCount >= 2 && !context.join(' ').includes('Promise.all') && !/(then\(|\.then)/.test(context.join(' '));
  }

  private isMissingNullCheck(line: string): boolean {
    return /\.(find|get|fetch|query|load)\s*\(/.test(line) &&
      !(/(await|\.then|const\s+\w+\s*=|let\s+\w+\s*=)/.test(line) && /\?\s*\.|&&\s+\w+/.test(line));
  }

  private isHardcodedSecret(line: string): boolean {
    return /(password|secret|api.?key|token|private.?key)\s*[:=]\s*['"`]/.test(line) &&
      !/(process\.env|config|secrets)/.test(line);
  }

  private isComment(line: string, language: string): boolean {
    const cs = COMMENT_SYNTAX[language] ?? COMMENT_SYNTAX.unknown;
    return line.startsWith(cs.single) || line.startsWith(cs.open) || line.startsWith('#');
  }

  private parseAnnotationsFromResponse(code: string, language: string): CodeAnnotation[] {
    return [];
  }

  private extractAnnotationsFromText(llmText: string, code: string): CodeAnnotation[] {
    const annotations: CodeAnnotation[] = [];
    const lines = code.split('\n');

    const pattern = /\b(WHY|RISK|CONSIDER|DANGER):\s*(.+)/gi;
    let match;
    while ((match = pattern.exec(llmText)) !== null) {
      const type = match[1] as CodeAnnotation['type'];
      const message = match[2].trim();
      const lineNum = this.guessLineNumber(llmText, match.index, lines);
      annotations.push({ line: lineNum, type, message });
    }

    return annotations;
  }

  private guessLineNumber(text: string, position: number, lines: string[]): number {
    const beforeMatch = text.slice(0, position);
    const newlines = (beforeMatch.match(/\n/g) ?? []).length;
    return Math.min(lines.length, Math.max(1, Math.round(newlines / 2)));
  }
}
