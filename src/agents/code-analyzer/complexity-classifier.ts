import { CodeRequest, RequestAnalysis, SocraticDecision, AgentMode } from '../../types';
import { isConceptMastered } from '../session-tracker/developer-db';

const SIMPLE_PATTERNS = [
  /config/,
  /\.env/,
  /boilerplate/,
  /template/,
  /scaffold/,
  /example/,
  /simple/,
];

const SIMPLE_CRUD_PATTERNS = [
  /^get\s+\w+\s+by\s+id/i,
  /^list\s+\w+/i,
  /^create\s+\w+/i,
  /^delete\s+\w+/i,
  /^crud/i,
];

const SYNTAX_PATTERNS = [
  /how\s+(do|to|can|should)\s+I/i,
  /what\s+(is|does|are)/i,
  /syntax/i,
  /example of/i,
];

const BOILERPLATE_KEYWORDS = ['config', '.env', 'generate config', 'setup', 'initialize'];

const PRODUCTION_URGENCY_PATTERNS = [
  /production.*down/i,
  /urgent/i,
  /emergency/i,
  /prod.*(broken|down|error|crash)/i,
  /critical.*bug/i,
  /customer.*(can.?t|not).*login/i,
  /money.*lost/i,
  /data.*lost/i,
  /security.*breach/i,
];

export class ComplexityClassifier {
  analyze(request: CodeRequest, developerId: string): SocraticDecision {
    if (this.isEmergency(request)) {
      return {
        trigger: false,
        mode: 'EMERGENCY',
        reason: 'production_urgency',
        generateWithNote: true,
      };
    }

    if (this.isSimple(request)) {
      return {
        trigger: false,
        mode: 'ANNOTATED',
        reason: 'too_simple',
      };
    }

    const analysis = this.analyzeRequest(request);
    const allConceptsMastered = analysis.touchedConcepts.every(c =>
      isConceptMastered(developerId, c)
    );

    if (analysis.touchedConcepts.length > 0 && allConceptsMastered) {
      return {
        trigger: false,
        mode: 'TRUSTED',
        reason: 'all_concepts_mastered',
      };
    }

    const riskScore = this.calculateRiskScore(analysis);
    const MEDIUM_RISK_THRESHOLD = 1;

    if (riskScore >= MEDIUM_RISK_THRESHOLD || analysis.complexityScore >= 1) {
      return {
        trigger: true,
        mode: 'SOCRATIC',
      };
    }

    return {
      trigger: false,
      mode: 'ANNOTATED',
      reason: 'low_risk',
    };
  }

  private isEmergency(request: CodeRequest): boolean {
    const fullText = [
      request.rawPrompt,
      request.context?.developerMessage,
      request.context?.urgency,
    ]
      .filter(Boolean)
      .join(' ');

    if (request.context?.urgency === 'production') return true;

    return PRODUCTION_URGENCY_PATTERNS.some(p => p.test(fullText));
  }

  private isSimple(request: CodeRequest): boolean {
    const prompt = request.rawPrompt.toLowerCase();

    if (SIMPLE_PATTERNS.some(p => p.test(prompt))) return true;
    if (SIMPLE_CRUD_PATTERNS.some(p => p.test(prompt))) return true;
    if (SYNTAX_PATTERNS.some(p => p.test(prompt))) return true;
    if (BOILERPLATE_KEYWORDS.some(k => prompt.includes(k)) && prompt.length < 80) return true;

    return false;
  }

  analyzeRequest(request: CodeRequest): RequestAnalysis {
    const prompt = request.rawPrompt.toLowerCase();

    const involvesDatabaseOperation = /database|db|sql|query|insert|update|delete|select|table|find|save|create|mongo|postgres|mysql|orm|prisma|sequelize|record|document|data|dữ liệu|lưu|tạo|ghi|xóa|posts|comments/i.test(prompt);
    const involvesAsyncOperations = /async|await|promise|callback|then|concurrent|parallel|fetch|request|api|call|endpoint|gọi|hàm|function/i.test(prompt);
    const involvesUserInput = /user input|user.*enter|form|body|params|query.*param|url.*param|req\.|request\.|userId|id|customer|client|nhận|tham số|param|:id|docId/i.test(prompt);
    const involvesMoneyOrInventory = /payment|money|balance|charge|price|cost|order|checkout|buy|sell|inventory|stock|deduct|subtract|transfer|thanh toán|tiền|hoàn|refund|chuyển|amount/i.test(prompt);
    const involvesCaching = /cache|redis|memoize|invalidate|ttl/i.test(prompt);
    const hasMultipleWriteOperations = (prompt.match(/update|insert|delete|create|save|remove|xóa|lưu|ghi|tạo|xóa/g)?.length ?? 0) >= 2;
    const mentionsTransaction = /transaction|begin|commit|rollback|atomic|giao dịch/i.test(prompt);
    const hasUserInputInQuery = (involvesUserInput && involvesDatabaseOperation &&
      /where|find.*by|search.*by|filter|tìm|tên|email|theo/i.test(prompt));
    const mentionsParameterization = /parameterize|prepared statement|placeholder|\?|:param|\$[0-9]/i.test(prompt);
    const hasReadModifyWrite = /fetch.*update|read.*write|find.*save|read.*modify|get.*update|load.*save|fetch.*merge|đọc.*ghi|lấy.*cập nhật|lấy.*lưu/i.test(prompt);
    const mentionsLocking = /lock|mutex|semaphore|optimistic|pessimistic|select for update|khóa|lock/i.test(prompt);
    const hasMultipleAwaits = (prompt.match(/await/g)?.length ?? 0) >= 2;
    const awaitsAreIndependent = hasMultipleAwaits && !/(depends on|after.*completes|need.*result|wait.*for|sequentially)/i.test(prompt);

    const touchedConcepts: string[] = [];
    if (involvesDatabaseOperation && hasMultipleWriteOperations && !mentionsTransaction) touchedConcepts.push('database-transactions');
    if (involvesUserInput && hasUserInputInQuery && !mentionsParameterization) touchedConcepts.push('sql-injection');
    if (involvesMoneyOrInventory && !/idempoten|key/i.test(prompt)) touchedConcepts.push('idempotency');
    if (involvesUserInput && (/(get|document|file|download).*(by.*id|:id)|document|middleware|admin|quyền|authoriz|permission/i.test(prompt)) && !/authoriz|permission|owner|quyền|admin/i.test(prompt)) touchedConcepts.push('authorization');
    if (hasReadModifyWrite && !mentionsLocking) touchedConcepts.push('race-condition');
    if (hasMultipleAwaits && awaitsAreIndependent) touchedConcepts.push('async-parallelism');
    if ((involvesDatabaseOperation || involvesUserInput) && !/error|catch|try|exception|handle|lỗi/i.test(prompt)) touchedConcepts.push('error-propagation');
    if (involvesDatabaseOperation && /loop|foreach|map|for\s|từng|vòng/i.test(prompt)) touchedConcepts.push('n-plus-one');
    if ((/search|find|lookup|contains|includes|tìm/i.test(prompt)) && /array|list|object|mảng/i.test(prompt)) touchedConcepts.push('data-structure-selection');
    if (involvesCaching) touchedConcepts.push('cache-consistency');

    const complexityScore =
      (involvesDatabaseOperation ? 2 : 0) +
      (involvesAsyncOperations ? 1 : 0) +
      (involvesUserInput ? 2 : 0) +
      (involvesMoneyOrInventory ? 3 : 0) +
      (involvesCaching ? 1 : 0) +
      (hasMultipleWriteOperations ? 2 : 0) +
      (hasReadModifyWrite ? 1 : 0) +
      (hasMultipleAwaits ? 0.5 : 0);

    return {
      involvesDatabaseOperation,
      involvesAsyncOperations,
      involvesUserInput,
      involvesMoneyOrInventory,
      involvesCaching,
      hasMultipleWriteOperations,
      mentionsTransaction,
      hasUserInputInQuery,
      mentionsParameterization,
      hasReadModifyWrite,
      mentionsLocking,
      hasMultipleAwaits,
      awaitsAreIndependent,
      touchedConcepts,
      complexityScore,
    };
  }

  calculateRiskScore(analysis: RequestAnalysis): number {
    let score = 0;

    if (analysis.involvesDatabaseOperation && analysis.hasMultipleWriteOperations && !analysis.mentionsTransaction) score += 3;
    if (analysis.involvesUserInput && analysis.hasUserInputInQuery && !analysis.mentionsParameterization) score += 3;
    if (analysis.involvesMoneyOrInventory) score += 3;
    if (analysis.hasReadModifyWrite && !analysis.mentionsLocking) score += 2;
    if (analysis.involvesUserInput && !/authoriz|permission|owner/i.test(analysis.toString())) score += 2;

    return score;
  }
}
