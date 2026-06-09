// ─── Request Types ───

export interface CodeRequest {
  id: string;
  rawPrompt: string;
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'java' | 'unknown';
  context?: {
    urgency?: 'normal' | 'production';
    developerMessage?: string;
    currentFile?: string;
    projectContext?: string;
  };
}

export interface RequestAnalysis {
  involvesDatabaseOperation: boolean;
  involvesAsyncOperations: boolean;
  involvesUserInput: boolean;
  involvesMoneyOrInventory: boolean;
  involvesCaching: boolean;
  hasMultipleWriteOperations: boolean;
  mentionsTransaction: boolean;
  hasUserInputInQuery: boolean;
  mentionsParameterization: boolean;
  hasReadModifyWrite: boolean;
  mentionsLocking: boolean;
  hasMultipleAwaits: boolean;
  awaitsAreIndependent: boolean;
  touchedConcepts: string[];
  complexityScore: number;
}

// ─── Blind Spot Types ───

export type BlindSpotSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface BlindSpot {
  type: string;
  severity: BlindSpotSeverity;
  description: string;
  targetQuestion: string;
  category: string;
}

export interface BlindSpotCategory {
  name: string;
  severity: BlindSpotSeverity;
  triggers: string[];
  questionTemplate: string;
}

// ─── Question Types ───

export type QuestionTier = 'tier1' | 'tier2' | 'tier3';

export interface SocraticQuestion {
  id: string;
  tier: QuestionTier;
  text: string;
  blindSpotType: string;
  conceptTested: string;
  specificityScore: number;
}

// ─── Answer & Evaluation Types ───

export type UnderstandingLevel =
  | 'DEEP'
  | 'ADEQUATE'
  | 'PARTIAL'
  | 'SURFACE'
  | 'MISSING'
  | 'DEFLECTING';

export interface AnswerEvaluation {
  question: SocraticQuestion;
  developerAnswer: string;
  understandingLevel: UnderstandingLevel;
  keyInsightPresent: boolean;
  keyInsightMissing: string;
  followUpQuestion?: string;
}

// ─── Unlock Types ───

export type UnlockType = 'FULL_UNLOCK' | 'PARTIAL_UNLOCK' | 'TEACH_FIRST' | 'EMERGENCY';

export interface UnlockDecision {
  type: UnlockType;
  code?: string;
  teachConcept?: string;
  gaps?: AnswerEvaluation[];
  note?: string;
  celebration?: string;
  instruction?: string;
}

// ─── Session Decision ───

export type AgentMode = 'SOCRATIC' | 'ANNOTATED' | 'REVERSE_SOCRATIC' | 'AUDIT' | 'TRANSPARENT_CHOICE' | 'EMERGENCY' | 'TRUSTED';

export interface SocraticDecision {
  trigger: boolean;
  mode: AgentMode;
  reason?: string;
  blindSpots?: BlindSpot[];
  questions?: SocraticQuestion[];
  generateWithNote?: boolean;
}

// ─── Developer Understanding Types ───

export interface ConceptMastery {
  concept: string;
  demonstratedDate: string;
  demonstratedIn: string;
  notes: string;
}

export interface ConceptInProgress {
  concept: string;
  exposureCount: number;
  lastQuestioned: string;
}

export interface ConceptGap {
  concept: string;
  missedCount: number;
  lastMissedDate: string;
}

export interface DeveloperUnderstandingGraph {
  developerId: string;
  masteredConcepts: ConceptMastery[];
  learningConcepts: ConceptInProgress[];
  gapConcepts: ConceptGap[];
  trajectory: {
    startDate: string;
    conceptsLearnedCount: number;
    incidentsPreventedEstimate: number;
    totalSocraticSessions: number;
  };
}

// ─── Annotation Types ───

export interface CodeAnnotation {
  line: number;
  type: 'WHY' | 'RISK' | 'CONSIDER' | 'DANGER';
  message: string;
}

export interface AnnotatedCode {
  originalCode: string;
  language: string;
  annotations: CodeAnnotation[];
}

// ─── Pipeline Types ───

export interface PipelineResult {
  decision: SocraticDecision;
  questions?: SocraticQuestion[];
  evaluations?: AnswerEvaluation[];
  unlock?: UnlockDecision;
  annotatedCode?: AnnotatedCode;
  sessionNote?: string;
}
