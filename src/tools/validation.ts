import { z } from 'zod';
import { logger } from './logger';

export const CodeRequestSchema = z.object({
  id: z.string().min(1),
  rawPrompt: z.string().min(1).max(16000),
  language: z.enum(['typescript', 'javascript', 'python', 'go', 'java', 'unknown']),
  context: z
    .object({
      urgency: z.enum(['normal', 'production']).optional(),
      developerMessage: z.string().max(16000).optional(),
      currentFile: z.string().max(1000).optional(),
      projectContext: z.string().max(16000).optional(),
    })
    .optional(),
});

export const DeveloperIdSchema = z.string().min(1).max(200);

export const AnswersSchema = z.array(z.string().max(16000)).min(1).max(3);

export const ReviewCodeSchema = z.object({
  code: z.string().min(1).max(100000),
  language: z.string().max(50),
  developerId: z.string().min(1).max(200),
});

export const CodeAnnotationSchema = z.object({
  line: z.number().int().positive(),
  type: z.enum(['WHY', 'RISK', 'CONSIDER', 'DANGER']),
  message: z.string().min(1).max(1000),
});

export const PipelineResultSchema = z.object({
  decision: z.object({
    trigger: z.boolean(),
    mode: z.enum(['SOCRATIC', 'ANNOTATED', 'REVERSE_SOCRATIC', 'AUDIT', 'TRANSPARENT_CHOICE', 'EMERGENCY', 'TRUSTED']),
    reason: z.string().optional(),
    blindSpots: z.array(z.object({
      type: z.string(),
      severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
      description: z.string(),
      targetQuestion: z.string(),
      category: z.string(),
    })).optional(),
    questions: z.array(z.object({
      id: z.string(),
      tier: z.enum(['tier1', 'tier2', 'tier3']),
      text: z.string(),
      blindSpotType: z.string(),
      conceptTested: z.string(),
      specificityScore: z.number().min(0).max(5),
    })).optional(),
    generateWithNote: z.boolean().optional(),
  }),
  questions: z.array(z.object({
    id: z.string(),
    tier: z.enum(['tier1', 'tier2', 'tier3']),
    text: z.string(),
    blindSpotType: z.string(),
    conceptTested: z.string(),
    specificityScore: z.number().min(0).max(5),
  })).optional(),
  evaluations: z.array(z.object({
    question: z.object({
      id: z.string(),
      tier: z.enum(['tier1', 'tier2', 'tier3']),
      text: z.string(),
      blindSpotType: z.string(),
      conceptTested: z.string(),
      specificityScore: z.number().min(0).max(5),
    }),
    developerAnswer: z.string(),
    understandingLevel: z.enum(['DEEP', 'ADEQUATE', 'PARTIAL', 'SURFACE', 'MISSING', 'DEFLECTING']),
    keyInsightPresent: z.boolean(),
    keyInsightMissing: z.string(),
    followUpQuestion: z.string().optional(),
  })).optional(),
  unlock: z.object({
    type: z.enum(['FULL_UNLOCK', 'PARTIAL_UNLOCK', 'TEACH_FIRST', 'EMERGENCY']),
    code: z.string().optional(),
    teachConcept: z.string().optional(),
    gaps: z.array(z.any()).optional(),
    note: z.string().optional(),
    celebration: z.string().optional(),
    instruction: z.string().optional(),
  }).optional(),
  annotatedCode: z.object({
    originalCode: z.string(),
    language: z.string(),
    annotations: z.array(CodeAnnotationSchema),
  }).optional(),
  sessionNote: z.string().optional(),
});

export function validate<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Validation failed for ${context}:\n${issues}`);
  }
  return result.data;
}

export function validateOrWarn<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    logger.warn({ issues: result.error.issues }, `Validation warning for ${context}: ${issues}`);
    return null;
  }
  return result.data;
}
