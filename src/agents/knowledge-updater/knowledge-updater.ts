import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface CsConcept {
  id: string;
  display: string;
  category: string;
  prerequisites: string[];
  severity: string;
}

interface BlindSpotRule {
  name: string;
  severity: string;
  triggers: string[];
  questionTemplate: string;
}

export class KnowledgeUpdater {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(__dirname, '..', '..', 'data');
  }

  addConcept(concept: CsConcept): void {
    const conceptsPath = path.join(this.dataDir, 'cs-concepts.yaml');
    const data = yaml.load(fs.readFileSync(conceptsPath, 'utf8')) as any;

    const existing = data.concepts.find((c: CsConcept) => c.id === concept.id);
    if (existing) {
      Object.assign(existing, concept);
    } else {
      data.concepts.push(concept);
    }

    fs.writeFileSync(conceptsPath, yaml.dump(data, { indent: 2, lineWidth: 120 }));
  }

  removeConcept(conceptId: string): void {
    const conceptsPath = path.join(this.dataDir, 'cs-concepts.yaml');
    const data = yaml.load(fs.readFileSync(conceptsPath, 'utf8')) as any;

    data.concepts = data.concepts.filter((c: CsConcept) => c.id !== conceptId);

    for (const c of data.concepts) {
      c.prerequisites = c.prerequisites.filter((p: string) => p !== conceptId);
    }

    fs.writeFileSync(conceptsPath, yaml.dump(data, { indent: 2, lineWidth: 120 }));
  }

  addBlindSpotTrigger(
    blindSpotType: string,
    severity: string,
    trigger: string
  ): void {
    const taxonomyPath = path.join(this.dataDir, 'blind-spot-taxonomy.yaml');
    const data = yaml.load(fs.readFileSync(taxonomyPath, 'utf8')) as any;

    const section = data[severity];
    if (!section) return;

    const rule = section[blindSpotType];
    if (!rule) return;

    if (!rule.triggers.includes(trigger)) {
      rule.triggers.push(trigger);
    }

    fs.writeFileSync(taxonomyPath, yaml.dump(data, { indent: 2, lineWidth: 120 }));
  }

  addQuestionTemplate(
    blindSpotType: string,
    tier: 'tier1' | 'tier2' | 'tier3',
    question: string
  ): void {
    const templatesPath = path.join(this.dataDir, 'question-templates.yaml');
    const data = yaml.load(fs.readFileSync(templatesPath, 'utf8')) as any;

    const entry = data[blindSpotType];
    if (!entry) return;

    const tierList = entry[tier];
    if (!tierList) return;

    if (!tierList.includes(question)) {
      tierList.push(question);
    }

    fs.writeFileSync(templatesPath, yaml.dump(data, { indent: 2, lineWidth: 120 }));
  }

  removeQuestionTemplate(
    blindSpotType: string,
    tier: 'tier1' | 'tier2' | 'tier3',
    question: string
  ): void {
    const templatesPath = path.join(this.dataDir, 'question-templates.yaml');
    const data = yaml.load(fs.readFileSync(templatesPath, 'utf8')) as any;

    const entry = data[blindSpotType];
    if (!entry || !entry[tier]) return;

    entry[tier] = entry[tier].filter((q: string) => q !== question);

    fs.writeFileSync(templatesPath, yaml.dump(data, { indent: 2, lineWidth: 120 }));
  }

  async syncOwaspTop10(): Promise<string[]> {
    const NEW_PATTERNS: string[] = [];
    const patterns = [
      { type: 'sql-injection', severity: 'CRITICAL', trigger: 'owasp-top10', desc: 'A03:2021 — Injection' },
      { type: 'auth-bypass', severity: 'CRITICAL', trigger: 'owasp-top10', desc: 'A01:2021 — Broken Access Control' },
      { type: 'silent-error', severity: 'HIGH', trigger: 'owasp-top10', desc: 'A06:2021 — Vulnerable Components' },
    ];

    for (const pattern of patterns) {
      try {
        this.addBlindSpotTrigger(pattern.type, pattern.severity, pattern.trigger);
        NEW_PATTERNS.push(`${pattern.desc} → ${pattern.type}`);
      } catch {
        continue;
      }
    }

    return NEW_PATTERNS;
  }

  getConcepts(): CsConcept[] {
    const conceptsPath = path.join(this.dataDir, 'cs-concepts.yaml');
    const data = yaml.load(fs.readFileSync(conceptsPath, 'utf8')) as any;
    return data.concepts;
  }

  getBlindSpotRules(): Map<string, BlindSpotRule[]> {
    const taxonomyPath = path.join(this.dataDir, 'blind-spot-taxonomy.yaml');
    const data = yaml.load(fs.readFileSync(taxonomyPath, 'utf8')) as any;
    const result = new Map<string, BlindSpotRule[]>();

    for (const [severity, types] of Object.entries(data)) {
      for (const [typeName, config] of Object.entries(types as Record<string, any>)) {
        const rule: BlindSpotRule = {
          name: typeName,
          severity,
          triggers: config.triggers,
          questionTemplate: config.question_template,
        };
        if (!result.has(severity)) result.set(severity, []);
        result.get(severity)!.push(rule);
      }
    }

    return result;
  }
}
