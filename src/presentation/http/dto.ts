import { Company, type CompanyProps, type CompanyValidationError } from "../../domain/company/Company";
import { Result } from "../../domain/result/Result";

export type CompanyDto = CompanyProps;

export function mapCompanies(dtos: readonly CompanyDto[]) {
  const companies: Company[] = [];
  const errors: CompanyValidationError[] = [];

  for (const dto of dtos) {
    const created = Company.create(dto);
    if (created.kind === "err") {
      errors.push(created.error);
      continue;
    }
    companies.push(created.value);
  }

  if (errors.length) {
    return Result.err(errors);
  }

  return Result.ok(companies);
}
