import { Company } from "../../domain/company/Company";

export interface BlockingKeyFactory {
  createKey(company: Company): string | null;
}
