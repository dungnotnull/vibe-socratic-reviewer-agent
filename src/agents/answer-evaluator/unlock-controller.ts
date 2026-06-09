import { AnswerEvaluation, UnlockDecision, UnlockType } from '../../types';

export class UnlockController {
  determine(evaluations: AnswerEvaluation[]): UnlockDecision {
    if (evaluations.length === 0) {
      return {
        type: 'EMERGENCY',
        code: 'complete_with_annotations',
        note: '⚠️ Không có câu hỏi nào được đánh giá. Code được generate với annotation.',
      };
    }

    const criticalQ = evaluations[0];

    // Critical question fully missing or surface-level → teach first, give minimal safe code
    if (
      criticalQ.understandingLevel === 'MISSING' ||
      criticalQ.understandingLevel === 'SURFACE'
    ) {
      return {
        type: 'TEACH_FIRST',
        teachConcept: criticalQ.keyInsightMissing,
        code: 'minimal_safe_version',
        note: `⚠️ Code này có ${criticalQ.question.blindSpotType} risk. Tôi đã viết version an toàn nhất có thể, nhưng bạn cần hiểu ${criticalQ.keyInsightMissing} trước khi deploy lên production.`,
      };
    }

    // Developer is deflecting → give code but explain
    if (criticalQ.understandingLevel === 'DEFLECTING') {
      return {
        type: 'FULL_UNLOCK',
        code: 'complete_with_annotations',
        note: `Code đây. Lưu ý: Tôi vẫn thấy ${criticalQ.question.blindSpotType} risk trong yêu cầu này. Khi bạn review code, hãy xem tôi đã xử lý nó thế nào.`,
      };
    }

    // All deep or adequate → full unlock + celebrate
    const allGood = evaluations.every(
      e => e.understandingLevel === 'DEEP' || e.understandingLevel === 'ADEQUATE'
    );

    if (allGood) {
      const concepts = evaluations.map(e => e.question.conceptTested).filter(Boolean).join(', ');
      return {
        type: 'FULL_UNLOCK',
        code: 'complete_with_annotations',
        celebration: `Bạn đã xác định được ${concepts}. Đây chính xác là những gì cần nghĩ đến. Code đây.`,
      };
    }

    // Mixed results → partial unlock with gaps noted
    const gaps = evaluations.filter(e => e.understandingLevel === 'PARTIAL');
    return {
      type: 'PARTIAL_UNLOCK',
      code: 'core_logic_without_risky_parts',
      gaps,
      instruction: 'Tôi đã viết phần core. Bạn cần tự thêm phần xử lý lỗi.',
    };
  }
}
