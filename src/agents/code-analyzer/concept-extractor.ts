import { RequestAnalysis } from '../../types';
import { loadCsConcepts, getConceptPrerequisites } from '../../tools/config-loader';

export class ConceptExtractor {
  extract(requestAnalysis: RequestAnalysis): {
    primaryConcepts: string[];
    prerequisiteConcepts: string[];
    conceptChain: string[];
  } {
    const primaryConcepts = this.identifyConcepts(requestAnalysis);
    const prerequisiteConcepts = this.collectPrerequisites(primaryConcepts);
    const conceptChain = this.orderByDependency([...primaryConcepts, ...prerequisiteConcepts]);

    return {
      primaryConcepts,
      prerequisiteConcepts,
      conceptChain,
    };
  }

  private identifyConcepts(analysis: RequestAnalysis): string[] {
    return analysis.touchedConcepts;
  }

  private collectPrerequisites(concepts: string[]): string[] {
    const allPrereqs = new Set<string>();

    for (const concept of concepts) {
      const prereqs = getConceptPrerequisites(concept);
      for (const prereq of prereqs) {
        allPrereqs.add(prereq);
      }
    }

    return Array.from(allPrereqs).filter(p => !concepts.includes(p));
  }

  private orderByDependency(concepts: string[]): string[] {
    const allConcepts = loadCsConcepts().concepts;
    const visited = new Set<string>();
    const result: string[] = [];

    function visit(conceptId: string) {
      if (visited.has(conceptId)) return;
      visited.add(conceptId);

      const entry = allConcepts.find(c => c.id === conceptId);
      if (entry) {
        for (const prereq of entry.prerequisites) {
          visit(prereq);
        }
      }

      result.push(conceptId);
    }

    for (const concept of concepts) {
      visit(concept);
    }

    return result;
  }
}
