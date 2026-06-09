import { CodeRequest, SocraticDecision, PipelineResult, SocraticQuestion, AnswerEvaluation, UnlockDecision, AnnotatedCode } from '../types';
import { ComplexityClassifier } from './code-analyzer/complexity-classifier';
import { BlindSpotDetector } from './code-analyzer/blind-spot-detector';
import { ConceptExtractor } from './code-analyzer/concept-extractor';
import { QuestionGenerator } from './question-generator/tier-generator';
import { AnswerEvaluator } from './answer-evaluator/understanding-scorer';
import { UnlockController } from './answer-evaluator/unlock-controller';
import { ConceptTeacher } from './answer-evaluator/concept-teacher';
import { CodeAnnotator } from './code-annotator/code-annotator';
import { QuestionQualitySystem } from './knowledge-updater/question-quality';
import {
  getOrCreateDeveloper,
  loadDeveloperGraph,
  recordMastery,
  recordProgress,
  recordGap,
  recordSession,
  recordIncidentPrevented,
  isConceptMastered,
} from './session-tracker/developer-db';
import { llmClient } from '../tools/llm-client';

export class Orchestrator {
  private classifier: ComplexityClassifier;
  private blindSpotDetector: BlindSpotDetector;
  private conceptExtractor: ConceptExtractor;
  private questionGenerator: QuestionGenerator;
  private answerEvaluator: AnswerEvaluator;
  private unlockController: UnlockController;
  private conceptTeacher: ConceptTeacher;
  private codeAnnotator: CodeAnnotator;
  private qualitySystem: QuestionQualitySystem;

  constructor() {
    this.classifier = new ComplexityClassifier();
    this.blindSpotDetector = new BlindSpotDetector();
    this.conceptExtractor = new ConceptExtractor();
    this.questionGenerator = new QuestionGenerator();
    this.answerEvaluator = new AnswerEvaluator();
    this.unlockController = new UnlockController();
    this.conceptTeacher = new ConceptTeacher();
    this.codeAnnotator = new CodeAnnotator();
    this.qualitySystem = new QuestionQualitySystem();
  }

  async intercept(request: CodeRequest, developerId: string): Promise<PipelineResult> {
    getOrCreateDeveloper(developerId);
    const decision = this.classifier.analyze(request, developerId);

    if (decision.mode === 'EMERGENCY') {
      return this.handleEmergency(request, decision);
    }

    if (!decision.trigger) {
      return this.handleNonSocratic(request, decision);
    }

    return this.runSocraticPipeline(request, developerId);
  }

  private async handleEmergency(request: CodeRequest, decision: SocraticDecision): Promise<PipelineResult> {
    const code = await this.generateCodeFromLLM(request, 'EMERGENCY');
    const annotated = await this.codeAnnotator.annotate(code, request.language, 'minimal');

    return {
      decision,
      annotatedCode: annotated,
      sessionNote: '⚠️ EMERGENCY MODE — code generated without questions. Review before deploy.',
    };
  }

  private async handleNonSocratic(request: CodeRequest, decision: SocraticDecision): Promise<PipelineResult> {
    const code = await this.generateCodeFromLLM(request, decision.mode);
    const annotated = await this.codeAnnotator.annotate(code, request.language, 'full');

    return {
      decision,
      annotatedCode: annotated,
    };
  }

  private async runSocraticPipeline(request: CodeRequest, developerId: string): Promise<PipelineResult> {
    const decision: SocraticDecision = {
      trigger: true,
      mode: 'SOCRATIC',
    };

    const analysis = this.classifier.analyzeRequest(request);
    this.conceptExtractor.extract(analysis);

    const blindSpots = this.blindSpotDetector.detect(analysis, request.rawPrompt);
    decision.blindSpots = blindSpots;

    const questions = await this.questionGenerator.generate(blindSpots, request.rawPrompt);
    for (const q of questions) {
      this.qualitySystem.trackQuestion(q);
    }
    decision.questions = questions;

    return {
      decision,
      questions,
    };
  }

  async evaluateAnswers(
    questions: SocraticQuestion[],
    answers: string[],
    developerId: string
  ): Promise<{ evaluations: AnswerEvaluation[]; unlock: UnlockDecision; teachingMessage?: string }> {
    const evaluations: AnswerEvaluation[] = [];

    for (let i = 0; i < questions.length; i++) {
      const evaluation = await this.answerEvaluator.evaluate(questions[i], answers[i] ?? '');
      evaluations.push(evaluation);
      this.qualitySystem.recordAnswerQuality(questions[i].id, evaluation);
      this.qualitySystem.shouldRetire(questions[i].id);
    }

    for (const evaluation of evaluations) {
      const concept = evaluation.question.conceptTested;

      if (evaluation.understandingLevel === 'DEEP') {
        recordMastery(developerId, concept, 'socratic_answer', evaluation.developerAnswer);
      } else if (evaluation.understandingLevel === 'ADEQUATE') {
        recordProgress(developerId, concept);
      } else if (evaluation.understandingLevel === 'MISSING' || evaluation.understandingLevel === 'SURFACE') {
        recordGap(developerId, concept);
      }

      if (evaluation.understandingLevel === 'DEEP' && evaluation.keyInsightPresent) {
        recordIncidentPrevented(developerId);
      }
    }

    const unlock = this.unlockController.determine(evaluations);

    let teachingMessage: string | undefined;
    if (unlock.type === 'TEACH_FIRST' && unlock.teachConcept) {
      const criticalQ = questions[0];
      teachingMessage = await this.conceptTeacher.teach(
        unlock.teachConcept,
        criticalQ.text,
        ''
      );
    }

    return { evaluations, unlock, teachingMessage };
  }

  async deliverCode(code: string, language: string, unlock: UnlockDecision): Promise<AnnotatedCode> {
    const mode = unlock.type === 'TEACH_FIRST' ? 'minimal' : 'full';
    // Only annotate - actual code generation happens upstream via LLM
    return this.codeAnnotator.annotate(code, language, mode);
  }

  private async generateCodeFromLLM(request: CodeRequest, mode: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return this.generateStructuredStub(request, mode);
    }

    try {
      const response = await llmClient.complete(
        `You are an expert ${request.language} programmer. Write production-grade code for the following request.
Include ALL error handling, edge cases, security considerations, and performance optimizations.
Language: ${request.language}
Mode: ${mode}`,
        request.rawPrompt,
        { maxTokens: 8192, temperature: 0.3 }
      );
      return response.text;
    } catch {
      return this.generateStructuredStub(request, mode);
    }
  }

  private generateStructuredStub(request: CodeRequest, mode: string): string {
    const lang = request.language;
    const comment = lang === 'python' ? '#' : '//';

    const sections = [
      `${comment} Generated for: ${request.rawPrompt.slice(0, 100)}`,
      `${comment} Language: ${lang} | Mode: ${mode}`,
      ``,
      `${comment} ─── Implementation ───`,
      `${comment} Connect ANTHROPIC_API_KEY to generate real code.`,
      `${comment} The Socratic pipeline (blind spots, questions, evaluation, unlock) is fully functional.`,
      ``,
    ];

    if (mode === 'EMERGENCY') {
      sections.push(
        `${comment} ⚠️ EMERGENCY-GENERATED CODE — Review before deploy`,
        `${comment} Critical items to review:`,
        `${comment} 1. Error handling completeness`,
        `${comment} 2. Security (injection, auth, secrets)`,
        `${comment} 3. Concurrency (race conditions, idempotency)`,
      );
    }

    if (lang === 'typescript' || lang === 'javascript') {
      sections.push(
        `export async function handler(params: Record<string, unknown>): Promise<unknown> {`,
        `  ${comment} Implementation goes here when LLM is connected`,
        `  throw new Error('Not implemented — connect ANTHROPIC_API_KEY');`,
        `}`,
      );
    } else if (lang === 'python') {
      sections.push(
        `def handler(**params):`,
        `    # Implementation goes here when LLM is connected`,
        `    raise NotImplementedError('Connect ANTHROPIC_API_KEY')`,
      );
    } else if (lang === 'go') {
      sections.push(
        `func Handler(params map[string]interface{}) (interface{}, error) {`,
        `    // Implementation goes here when LLM is connected`,
        `    return nil, fmt.Errorf("not implemented — connect ANTHROPIC_API_KEY")`,
        `}`,
      );
    } else if (lang === 'java') {
      sections.push(
        `public class Handler {`,
        `    public static Object handle(Map<String, Object> params) {`,
        `        // Implementation goes here when LLM is connected`,
        `        throw new UnsupportedOperationException("Connect ANTHROPIC_API_KEY");`,
        `    }`,
        `}`,
      );
    }

    return sections.join('\n');
  }

  async reviewExistingCode(
    code: string,
    language: string,
    developerId: string
  ): Promise<{ blindSpots: ReturnType<BlindSpotDetector['detect']>; annotations: AnnotatedCode }> {
    const analysis = this.classifier.analyzeRequest({
      id: `review-${Date.now()}`,
      rawPrompt: `Review this code:\n\`\`\`${language}\n${code}\n\`\`\``,
      language: language as CodeRequest['language'],
    });

    const blindSpots = this.blindSpotDetector.detect(analysis, code);
    const annotations = await this.codeAnnotator.annotate(code, language, 'full');

    return { blindSpots, annotations };
  }

  async explainThisCode(
    code: string,
    developerId: string
  ): Promise<{ questions: SocraticQuestion[]; annotation: string }> {
    const request: CodeRequest = {
      id: `explain-${Date.now()}`,
      rawPrompt: code,
      language: 'unknown',
    };

    const analysis = this.classifier.analyzeRequest(request);
    const blindSpots = this.blindSpotDetector.detect(analysis, code);
    const questions = await this.questionGenerator.generate(blindSpots, code);

    return {
      questions,
      annotation: 'Hãy thử giải thích code này cho tôi trước. Tôi sẽ sửa nếu bạn nhầm.',
    };
  }

  async fullFlow(
    request: CodeRequest,
    developerId: string,
    answers: string[]
  ): Promise<PipelineResult> {
    const result = await this.intercept(request, developerId);

    if (!result.questions || result.questions.length === 0) {
      recordSession(
        request.id,
        developerId,
        result.decision.mode,
        request.rawPrompt,
        [],
        [],
        result.decision.mode === 'EMERGENCY' ? 'emergency_code_generated' : 'annotated_code_generated'
      );
      return result;
    }

    const { evaluations, unlock, teachingMessage } = await this.evaluateAnswers(
      result.questions,
      answers,
      developerId
    );

    result.evaluations = evaluations;
    result.unlock = unlock;

    const code = await this.generateCodeFromLLM(request, unlock.type);
    result.annotatedCode = await this.deliverCode(code, request.language, unlock);

    if (teachingMessage) {
      result.sessionNote = teachingMessage;
    }

    recordSession(
      request.id,
      developerId,
      'SOCRATIC',
      request.rawPrompt,
      result.decision.blindSpots?.map(b => b.type) ?? [],
      result.questions.map(q => q.text),
      unlock.type
    );

    return result;
  }

  getQualitySummary() {
    return this.qualitySystem.getSummary();
  }

  getDeveloperGraph(developerId: string) {
    return loadDeveloperGraph(developerId);
  }
}

export const orchestrator = new Orchestrator();
