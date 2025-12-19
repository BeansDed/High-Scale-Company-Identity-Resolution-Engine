import type { Company } from "../../domain/company/Company";
import type { MatchingStrategy, SimilarityContribution } from "../../domain/matching/MatchingStrategy";

export class DomainStrategy implements MatchingStrategy {
  public readonly name = "domain";

  constructor(private readonly weight: number = 60) {}

  public calculateSimilarity(source: Company, candidate: Company): SimilarityContribution {
    const a = source.normalizedDomain();
    const b = candidate.normalizedDomain();

    if (!a || !b) {
      return { strategy: this.name, points: 0 };
    }

    return { strategy: this.name, points: a === b ? this.weight : 0 };
  }
}
