import { Company, type CompanyProps } from "../company/Company";

export type GoldenRecord = {
  readonly id: string;
  readonly sourceCompanyId: string;
  readonly matchedCompanyId: string;
  readonly merged: CompanyProps;
};

export class GoldenRecordFactory {
  public create(source: Company, candidate: Company): GoldenRecord {
    const merged: CompanyProps = {
      id: `golden:${source.id}:${candidate.id}`,
      name: pickBestRequiredText(source.name, candidate.name),
      country: pickBestRequiredText(source.country, candidate.country),
      domain: pickBestText(source.domain, candidate.domain),
      taxId: pickBestText(source.taxId, candidate.taxId),
      addressLine1: pickBestText(source.addressLine1, candidate.addressLine1),
      city: pickBestText(source.city, candidate.city),
      region: pickBestText(source.region, candidate.region),
      postalCode: pickBestText(source.postalCode, candidate.postalCode)
    };

    return {
      id: merged.id,
      sourceCompanyId: source.id,
      matchedCompanyId: candidate.id,
      merged
    };
  }

  public materialize(record: GoldenRecord): Company {
    const created = Company.create(record.merged);
    if (created.kind === "err") {
      throw new Error(created.error.message);
    }
    return created.value;
  }
}

function pickBestText(a?: string, b?: string): string | undefined {
  const aa = a?.trim();
  const bb = b?.trim();

  if (!aa && !bb) return undefined;
  if (aa && !bb) return aa;
  if (!aa && bb) return bb;

  return (aa ?? "").length >= (bb ?? "").length ? aa : bb;
}

function pickBestRequiredText(a: string, b: string): string {
  const best = pickBestText(a, b);
  if (!best) {
    return a;
  }
  return best;
}
