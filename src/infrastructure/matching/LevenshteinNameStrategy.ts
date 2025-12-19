import levenshtein from "fast-levenshtein";
import type { Company } from "../../domain/company/Company";
import type { MatchingStrategy, SimilarityContribution } from "../../domain/matching/MatchingStrategy";

export class LevenshteinNameStrategy implements MatchingStrategy {
  public readonly name = "levenshtein_name";

  constructor(private readonly weight: number = 40) {}

  public calculateSimilarity(source: Company, candidate: Company): SimilarityContribution {
    const a = source.normalizedName();
    const b = candidate.normalizedName();

    if (!a || !b) {
      return { strategy: this.name, points: 0 };
    }

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) {
      return { strategy: this.name, points: 0 };
    }

    const dist = levenshtein.get(a, b);
    const similarity = Math.max(0, 1 - dist / maxLen);

    return { strategy: this.name, points: Math.round(this.weight * similarity) };
  }
}
