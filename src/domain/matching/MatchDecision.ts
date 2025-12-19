import { CompanyId } from "../company/Company";
import type { SimilarityContribution } from "./MatchingStrategy";

export type MatchDecision =
  | {
      readonly type: "confirmed";
      readonly sourceId: CompanyId;
      readonly candidateId: CompanyId;
      readonly score: number;
      readonly contributions: readonly SimilarityContribution[];
    }
  | {
      readonly type: "rejected";
      readonly score: number;
      readonly contributions: readonly SimilarityContribution[];
    };

export const MatchDecision = {
  confirmed(
    sourceId: CompanyId,
    candidateId: CompanyId,
    score: number,
    contributions: readonly SimilarityContribution[]
  ): MatchDecision {
    return { type: "confirmed", sourceId, candidateId, score, contributions };
  },

  rejected(score: number, contributions: readonly SimilarityContribution[]): MatchDecision {
    return { type: "rejected", score, contributions };
  }
};
