import { Result } from "../result/Result";

export type CompanyId = string;

export interface CompanyProps {
  id: CompanyId;
  name: string;
  country: string;
  domain?: string;
  taxId?: string;
  addressLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
}

export type CompanyValidationError = {
  readonly type: "CompanyValidationError";
  readonly message: string;
  readonly field?: keyof CompanyProps;
};

const LEGAL_NAME_SUFFIXES = new Set([
  "co",
  "company",
  "corp",
  "corporation",
  "inc",
  "incorporated",
  "limited",
  "llc",
  "ltd",
  "plc"
]);

export class Company {
  private constructor(private readonly props: CompanyProps) {}

  public static create(props: CompanyProps) {
    if (!props.id?.trim()) {
      return Result.err<CompanyValidationError>({
        type: "CompanyValidationError",
        message: "id is required",
        field: "id"
      });
    }

    if (!props.name?.trim()) {
      return Result.err<CompanyValidationError>({
        type: "CompanyValidationError",
        message: "name is required",
        field: "name"
      });
    }

    if (!props.country?.trim()) {
      return Result.err<CompanyValidationError>({
        type: "CompanyValidationError",
        message: "country is required",
        field: "country"
      });
    }

    return Result.ok(new Company({
      ...props,
      id: props.id.trim(),
      name: props.name.trim(),
      country: props.country.trim()
    }));
  }

  public get id(): CompanyId {
    return this.props.id;
  }

  public get name(): string {
    return this.props.name;
  }

  public get country(): string {
    return this.props.country;
  }

  public get domain(): string | undefined {
    return this.props.domain;
  }

  public get taxId(): string | undefined {
    return this.props.taxId;
  }

  public get addressLine1(): string | undefined {
    return this.props.addressLine1;
  }

  public get city(): string | undefined {
    return this.props.city;
  }

  public get region(): string | undefined {
    return this.props.region;
  }

  public get postalCode(): string | undefined {
    return this.props.postalCode;
  }

  public normalizedName(): string {
    return normalizeCompanyName(this.name);
  }

  public normalizedDomain(): string | undefined {
    if (!this.domain?.trim()) return undefined;
    return normalizeDomain(this.domain);
  }

  public normalizedTaxId(): string | undefined {
    if (!this.taxId?.trim()) return undefined;
    const normalized = this.taxId.replace(/[^a-z0-9]/gi, "").toUpperCase();
    return normalized || undefined;
  }
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeCompanyName(value: string): string {
  const tokens = normalizeText(value).split(" ").filter(Boolean);

  while (tokens.length > 1 && LEGAL_NAME_SUFFIXES.has(tokens[tokens.length - 1] ?? "")) {
    tokens.pop();
  }

  return tokens.join(" ");
}

export function normalizeDomain(domain: string): string {
  const cleaned = domain.trim().toLowerCase();
  const noProto = cleaned.replace(/^https?:\/\//, "");
  const hostWithAuth = noProto.split("/")[0] ?? noProto;
  const host = hostWithAuth.split("@").pop() ?? hostWithAuth;
  const withoutPort = host.replace(/:\d+$/, "");
  return withoutPort.replace(/^www\./, "").replace(/\.$/, "");
}
