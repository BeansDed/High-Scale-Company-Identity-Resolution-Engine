import { Company } from "../company/Company";

export type SimilarityContribution = {
  readonly strategy: string;
  readonly points: number;
};

export interface MatchingStrategy {
  readonly name: string;
  calculateSimilarity(source: Company, candidate: Company): SimilarityContribution;
}
