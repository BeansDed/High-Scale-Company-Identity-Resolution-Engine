import { Company, type CompanyProps, type CompanyValidationError } from "../../domain/company/Company";
import { Result } from "../../domain/result/Result";

export type CompanyDto = CompanyProps;

export function mapCompanies(dtos: readonly unknown[]) {
  const companies: Company[] = [];
  const errors: CompanyValidationError[] = [];

  for (const dto of dtos) {
    if (!dto || typeof dto !== "object" || Array.isArray(dto)) {
      errors.push({
        type: "CompanyValidationError",
        message: "company entry must be an object"
      });
      continue;
    }

    const created = Company.create(dto as CompanyDto);
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
