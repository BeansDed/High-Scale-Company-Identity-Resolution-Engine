import { Company } from "../company/Company";
import { ConfidenceThreshold } from "./ConfidenceThreshold";
import { MatchDecision } from "./MatchDecision";
import type { MatchingStrategy, SimilarityContribution } from "./MatchingStrategy";

export class CompanyIdentityLinker {
  constructor(private readonly strategies: readonly MatchingStrategy[]) {}

  public link(source: Company, candidate: Company): MatchDecision {
    const contributions: SimilarityContribution[] = this.strategies.map((strategy) =>
      strategy.calculateSimilarity(source, candidate)
    );

    const totalScore = contributions.reduce((sum, s) => sum + s.points, 0);

    if (totalScore >= ConfidenceThreshold.HIGH) {
      return MatchDecision.confirmed(source.id, candidate.id, totalScore, contributions);
    }

    return MatchDecision.rejected(totalScore, contributions);
  }
}
