import type { Company } from "../../domain/company/Company";
import type { MatchingStrategy, SimilarityContribution } from "../../domain/matching/MatchingStrategy";

export class TaxIdStrategy implements MatchingStrategy {
  public readonly name = "tax_id";

  constructor(private readonly weight: number = 100) {}

  public calculateSimilarity(source: Company, candidate: Company): SimilarityContribution {
    const a = source.normalizedTaxId();
    const b = candidate.normalizedTaxId();

    if (!a || !b) {
      return { strategy: this.name, points: 0 };
    }

    return { strategy: this.name, points: a === b ? this.weight : 0 };
  }
}
