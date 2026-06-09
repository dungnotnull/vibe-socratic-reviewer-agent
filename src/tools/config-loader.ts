import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { BlindSpotCategory, BlindSpotSeverity } from '../types';

interface TaxonomyYaml {
  [severity: string]: {
    [typeName: string]: {
      triggers: string[];
      question_template: string;
    };
  };
}

interface QuestionTemplateYaml {
  [category: string]: {
    tier1: string[];
    tier2: string[];
    tier3: string[];
  };
}

interface CsConceptsYaml {
  concepts: Array<{
    id: string;
    display: string;
    category: string;
    prerequisites: string[];
    severity: string;
  }>;
}

const DATA_DIR = path.join(__dirname, '..', 'data');

let taxonomyCache: Map<string, BlindSpotCategory> | null = null;
let questionTemplateCache: QuestionTemplateYaml | null = null;
let csConceptsCache: CsConceptsYaml | null = null;

export function loadBlindSpotTaxonomy(): Map<string, BlindSpotCategory> {
  if (taxonomyCache) return taxonomyCache;

  const raw = yaml.load(fs.readFileSync(path.join(DATA_DIR, 'blind-spot-taxonomy.yaml'), 'utf8')) as TaxonomyYaml;
  taxonomyCache = new Map();

  for (const [severity, types] of Object.entries(raw)) {
    for (const [typeName, config] of Object.entries(types)) {
      taxonomyCache.set(typeName, {
        name: typeName,
        severity: severity as BlindSpotSeverity,
        triggers: config.triggers,
        questionTemplate: config.question_template,
      });
    }
  }

  return taxonomyCache;
}

export function loadQuestionTemplates(): QuestionTemplateYaml {
  if (questionTemplateCache) return questionTemplateCache;

  questionTemplateCache = yaml.load(
    fs.readFileSync(path.join(DATA_DIR, 'question-templates.yaml'), 'utf8')
  ) as QuestionTemplateYaml;

  return questionTemplateCache;
}

export function loadCsConcepts(): CsConceptsYaml {
  if (csConceptsCache) return csConceptsCache;

  csConceptsCache = yaml.load(
    fs.readFileSync(path.join(DATA_DIR, 'cs-concepts.yaml'), 'utf8')
  ) as CsConceptsYaml;

  return csConceptsCache;
}

export function getConceptPrerequisites(conceptId: string): string[] {
  const data = loadCsConcepts();
  const concept = data.concepts.find(c => c.id === conceptId);
  return concept?.prerequisites ?? [];
}

export function getConceptSeverity(conceptId: string): BlindSpotSeverity {
  const data = loadCsConcepts();
  const concept = data.concepts.find(c => c.id === conceptId);
  return (concept?.severity as BlindSpotSeverity) ?? 'LOW';
}
