import { normalizeText, type Company } from "../../domain/company/Company";
import type { BlockingKeyFactory } from "../../application/ports/BlockingKeyFactory";

export class PrefixCountryBlockingKeyFactory implements BlockingKeyFactory {
  constructor(private readonly prefixLength: number = 3) {}

  public createKey(company: Company): string | null {
    const country = company.country?.trim().toUpperCase();
    if (!country) return null;

    const normalized = normalizeText(company.name);
    if (!normalized) return null;

    const lettersOnly = normalized.replace(/\s+/g, "");
    const prefix = lettersOnly.slice(0, this.prefixLength);
    if (!prefix) return null;

    return `${country}:${prefix}`;
  }
}
