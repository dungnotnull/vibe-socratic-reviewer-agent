import { SocraticQuestion, AnswerEvaluation, UnderstandingLevel } from '../../types';

export interface QuestionQualityRecord {
  questionId: string;
  questionText: string;
  blindSpotType: string;
  conceptTested: string;
  tier: string;
  timesAsked: number;
  timesAnsweredDEEP: number;
  timesAnsweredADEQUATE: number;
  timesAnsweredSURFACE: number;
  timesAnsweredMISSING: number;
  timesFoundRealIssue: number;
  timesThumbsUp: number;
  timesThumbsDown: number;
  lastAsked: string | null;
  retired: boolean;
  retiredReason: string | null;
}

export class QuestionQualitySystem {
  private records: Map<string, QuestionQualityRecord>;

  constructor() {
    this.records = new Map();
  }

  trackQuestion(question: SocraticQuestion): void {
    const existing = this.records.get(question.id);
    if (existing) {
      existing.timesAsked++;
      existing.lastAsked = new Date().toISOString();
      return;
    }

    this.records.set(question.id, {
      questionId: question.id,
      questionText: question.text,
      blindSpotType: question.blindSpotType,
      conceptTested: question.conceptTested,
      tier: question.tier,
      timesAsked: 1,
      timesAnsweredDEEP: 0,
      timesAnsweredADEQUATE: 0,
      timesAnsweredSURFACE: 0,
      timesAnsweredMISSING: 0,
      timesFoundRealIssue: 0,
      timesThumbsUp: 0,
      timesThumbsDown: 0,
      lastAsked: new Date().toISOString(),
      retired: false,
      retiredReason: null,
    });
  }

  recordAnswerQuality(questionId: string, evaluation: AnswerEvaluation): void {
    const record = this.records.get(questionId);
    if (!record) return;

    switch (evaluation.understandingLevel) {
      case 'DEEP':
        record.timesAnsweredDEEP++;
        break;
      case 'ADEQUATE':
        record.timesAnsweredADEQUATE++;
        break;
      case 'SURFACE':
        record.timesAnsweredSURFACE++;
        break;
      case 'MISSING':
        record.timesAnsweredMISSING++;
        break;
    }

    if (evaluation.understandingLevel === 'DEEP' && evaluation.keyInsightPresent) {
      record.timesFoundRealIssue++;
    }
  }

  recordFeedback(questionId: string, isHelpful: boolean): void {
    const record = this.records.get(questionId);
    if (!record) return;

    if (isHelpful) {
      record.timesThumbsUp++;
    } else {
      record.timesThumbsDown++;
    }
  }

  shouldRetire(questionId: string): boolean {
    const record = this.records.get(questionId);
    if (!record) return false;

    const total = record.timesAsked;
    if (total < 5) return false;

    const deepRate = record.timesAnsweredDEEP / total;
    if (deepRate > 0.8) {
      record.retired = true;
      record.retiredReason = 'Too easy — developers consistently answer deeply (>= 80% DEEP rate)';
      return true;
    }

    const thumbsDownRate = record.timesThumbsDown / Math.max(1, record.timesThumbsUp + record.timesThumbsDown);
    if (thumbsDownRate > 0.5 && total >= 10) {
      record.retired = true;
      record.retiredReason = 'High dissatisfaction rate (>= 50% thumbs down)';
      return true;
    }

    const missRate = record.timesAnsweredMISSING / total;
    if (missRate > 0.7 && total >= 8) {
      record.retired = true;
      record.retiredReason = 'Too hard — developers consistently cannot answer (>= 70% MISSING rate)';
      return true;
    }

    return false;
  }

  calculateEffectiveness(questionId: string): number {
    const record = this.records.get(questionId);
    if (!record || record.timesAsked === 0) return 0;

    const total = record.timesAsked;
    const deepWeight = 1.0;
    const adequateWeight = 0.5;
    const issueFoundBonus = 2.0;
    const thumbsUpBonus = 0.5;
    const thumbsDownPenalty = -1.0;

    let score =
      (record.timesAnsweredDEEP * deepWeight +
       record.timesAnsweredADEQUATE * adequateWeight +
       record.timesFoundRealIssue * issueFoundBonus +
       record.timesThumbsUp * thumbsUpBonus +
       record.timesThumbsDown * thumbsDownPenalty) / total;

    return Math.max(0, score);
  }

  selectBestQuestions(
    questions: SocraticQuestion[],
    count: number
  ): SocraticQuestion[] {
    const scored = questions.map(q => ({
      question: q,
      score: this.calculateEffectiveness(q.id),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter(s => {
        const record = this.records.get(s.question.id);
        return !record?.retired;
      })
      .slice(0, count)
      .map(s => s.question);
  }

  getSummary(): {
    totalQuestions: number;
    activeQuestions: number;
    retiredQuestions: number;
    averageEffectiveness: number;
    bestConcept: string | null;
    worstConcept: string | null;
  } {
    const all = Array.from(this.records.values());
    const active = all.filter(r => !r.retired);
    const retired = all.filter(r => r.retired);

    const avgEffectiveness = active.length > 0
      ? active.reduce((sum, r) => sum + this.calculateEffectiveness(r.questionId), 0) / active.length
      : 0;

    const byConcept = new Map<string, number[]>();
    for (const r of all) {
      if (!byConcept.has(r.conceptTested)) byConcept.set(r.conceptTested, []);
      byConcept.get(r.conceptTested)!.push(this.calculateEffectiveness(r.questionId));
    }

    let bestConcept: string | null = null;
    let bestScore = -Infinity;
    let worstConcept: string | null = null;
    let worstScore = Infinity;

    for (const [concept, scores] of byConcept) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > bestScore) { bestScore = avg; bestConcept = concept; }
      if (avg < worstScore) { worstScore = avg; worstConcept = concept; }
    }

    return {
      totalQuestions: all.length,
      activeQuestions: active.length,
      retiredQuestions: retired.length,
      averageEffectiveness: avgEffectiveness,
      bestConcept,
      worstConcept,
    };
  }
}
