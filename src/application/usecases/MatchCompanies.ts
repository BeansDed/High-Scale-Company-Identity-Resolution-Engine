import { Company } from "../../domain/company/Company";
import { CompanyIdentityLinker } from "../../domain/matching/CompanyIdentityLinker";
import type { MatchDecision } from "../../domain/matching/MatchDecision";
import { GoldenRecordFactory, type GoldenRecord } from "../../domain/record/GoldenRecord";
import { Result } from "../../domain/result/Result";
import type { BlockingKeyFactory } from "../ports/BlockingKeyFactory";
import type { SemanticCompanySearch } from "../ports/SemanticCompanySearch";

export type MatchCompaniesRequest = {
  readonly sourceCompanies: readonly Company[];
  readonly candidateCompanies: readonly Company[];
  readonly maxSemanticCandidates?: number;
};

export type MatchCompaniesError =
  | { readonly type: "InvalidRequest"; readonly message: string }
  | { readonly type: "SemanticSearchUnavailable"; readonly message: string };

export type CompanyMatch = {
  readonly decision: MatchDecision;
  readonly goldenRecord?: GoldenRecord;
};

export type MatchCompaniesResponse = {
  readonly matches: readonly CompanyMatch[];
  readonly comparisonsPerformed: number;
};

export class MatchCompanies {
  constructor(
    private readonly blockingKeyFactory: BlockingKeyFactory,
    private readonly identityLinker: CompanyIdentityLinker,
    private readonly goldenRecordFactory: GoldenRecordFactory,
    private readonly semanticSearch?: SemanticCompanySearch
  ) {}

  public async execute(
    request: MatchCompaniesRequest
  ): Promise<ReturnType<typeof Result.ok<MatchCompaniesResponse>> | ReturnType<typeof Result.err<MatchCompaniesError>>> {
    if (!request.sourceCompanies.length || !request.candidateCompanies.length) {
      return Result.err({ type: "InvalidRequest", message: "both datasets must be non-empty" });
    }

    const blocks = new Map<string, Company[]>();

    for (const candidate of request.candidateCompanies) {
      const key = this.blockingKeyFactory.createKey(candidate);
      if (!key) continue;

      const bucket = blocks.get(key);
      if (bucket) {
        bucket.push(candidate);
      } else {
        blocks.set(key, [candidate]);
      }
    }

    const matches: CompanyMatch[] = [];
    let comparisonsPerformed = 0;

    for (const source of request.sourceCompanies) {
      const blockKey = this.blockingKeyFactory.createKey(source);

      const candidates = blockKey ? blocks.get(blockKey) ?? [] : [];

      if (!blockKey) {
        const max = request.maxSemanticCandidates ?? 25;
        if (!this.semanticSearch) {
          matches.push({
            decision: {
              type: "rejected",
              score: 0,
              contributions: []
            }
          });
          continue;
        }

        const sem = await this.semanticSearch.findNearestNeighbors(source, max);
        if (sem.kind === "err") {
          return Result.err({ type: "SemanticSearchUnavailable", message: sem.error.message });
        }

        for (const candidate of sem.value) {
          comparisonsPerformed += 1;
          const decision = this.identityLinker.link(source, candidate);
          if (decision.type === "confirmed") {
            matches.push({ decision, goldenRecord: this.goldenRecordFactory.create(source, candidate) });
          }
        }

        continue;
      }

      for (const candidate of candidates) {
        comparisonsPerformed += 1;
        const decision = this.identityLinker.link(source, candidate);
        if (decision.type === "confirmed") {
          matches.push({ decision, goldenRecord: this.goldenRecordFactory.create(source, candidate) });
        }
      }
    }

    return Result.ok({ matches, comparisonsPerformed });
  }
}
