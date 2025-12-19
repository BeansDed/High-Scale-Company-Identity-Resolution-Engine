import { Company } from "../../domain/company/Company";
import type { Result } from "../../domain/result/Result";

export type SemanticSearchError = {
  readonly type: "SemanticSearchError";
  readonly message: string;
};

export interface SemanticCompanySearch {
  findNearestNeighbors(company: Company, topK: number): Promise<Result<Company[], SemanticSearchError>>;
}
