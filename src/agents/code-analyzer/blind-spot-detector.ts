import { RequestAnalysis, BlindSpot, BlindSpotSeverity } from '../../types';
import { loadBlindSpotTaxonomy } from '../../tools/config-loader';

export class BlindSpotDetector {
  private taxonomy: Map<string, { name: string; severity: BlindSpotSeverity; triggers: string[]; questionTemplate: string }>;

  constructor() {
    this.taxonomy = loadBlindSpotTaxonomy();
  }

  detect(requestAnalysis: RequestAnalysis, rawPrompt: string): BlindSpot[] {
    const blindSpots: BlindSpot[] = [];

    for (const [typeName, category] of this.taxonomy) {
      if (this.triggersMatch(requestAnalysis, rawPrompt, category)) {
        blindSpots.push({
          type: typeName,
          severity: category.severity,
          description: category.questionTemplate,
          targetQuestion: category.questionTemplate,
          category: typeName,
        });
      }
    }

    return this.rankBySeverity(blindSpots).slice(0, 3);
  }

  private triggersMatch(
    analysis: RequestAnalysis,
    prompt: string,
    category: { triggers: string[] }
  ): boolean {
    const promptLower = prompt.toLowerCase();

    for (const trigger of category.triggers) {
      if (promptLower.includes(trigger)) {
        return true;
      }
    }

    return false;
  }

  private rankBySeverity(blindSpots: BlindSpot[]): BlindSpot[] {
    const severityOrder: Record<BlindSpotSeverity, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };

    return blindSpots.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  }
}
