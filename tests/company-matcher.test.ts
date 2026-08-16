import assert from "node:assert/strict";
import {
  Company,
  normalizeCompanyName,
  normalizeDomain,
  type CompanyProps
} from "../src/domain/company/Company";
import { CompanyIdentityLinker } from "../src/domain/matching/CompanyIdentityLinker";
import { GoldenRecordFactory } from "../src/domain/record/GoldenRecord";
import { MatchCompanies } from "../src/application/usecases/MatchCompanies";
import { PrefixCountryBlockingKeyFactory } from "../src/infrastructure/blocking/PrefixCountryBlockingKeyFactory";
import { DomainStrategy } from "../src/infrastructure/matching/DomainStrategy";
import { LevenshteinNameStrategy } from "../src/infrastructure/matching/LevenshteinNameStrategy";
import { TaxIdStrategy } from "../src/infrastructure/matching/TaxIdStrategy";

function makeCompany(props: CompanyProps): Company {
  const result = Company.create(props);
  if (result.kind === "err") {
    throw new Error(result.error.message);
  }
  return result.value;
}

async function run(): Promise<void> {
  assert.equal(normalizeCompanyName("Apple Incorporated"), "apple");
  assert.equal(normalizeCompanyName("Example Company LLC"), "example");
  assert.equal(normalizeDomain("HTTPS://www.Apple.com:443/about"), "apple.com");

  const formattedTaxId = makeCompany({
    id: "tax-format",
    name: "Example Holdings",
    country: "US",
    taxId: "US-12 34"
  });
  assert.equal(formattedTaxId.normalizedTaxId(), "US1234");

  const source = makeCompany({
    id: "source-1",
    name: "Aple Inc",
    country: "US",
    domain: "https://apple.com"
  });
  const candidate = makeCompany({
    id: "candidate-1",
    name: "Apple Incorporated",
    country: "US",
    domain: "www.apple.com"
  });

  const blocking = new PrefixCountryBlockingKeyFactory();
  assert.equal(blocking.createKey(source), "US:ap");
  assert.equal(blocking.createKey(candidate), "US:ap");

  const linker = new CompanyIdentityLinker([
    new TaxIdStrategy(),
    new DomainStrategy(),
    new LevenshteinNameStrategy()
  ]);

  const decision = linker.link(source, candidate);
  assert.equal(decision.type, "confirmed");
  assert.ok(decision.score >= 120);

  const exactTaxSource = makeCompany({
    id: "tax-source",
    name: "Northwind Labs",
    country: "US",
    taxId: "12-3456789"
  });
  const exactTaxCandidate = makeCompany({
    id: "tax-candidate",
    name: "Completely Different Display Name",
    country: "US",
    taxId: "123456789"
  });
  const taxDecision = linker.link(exactTaxSource, exactTaxCandidate);
  assert.equal(taxDecision.type, "confirmed");
  assert.equal(taxDecision.score, 120);

  const matcher = new MatchCompanies(
    blocking,
    linker,
    new GoldenRecordFactory()
  );

  const matchResult = await matcher.execute({
    sourceCompanies: [source],
    candidateCompanies: [candidate]
  });
  assert.equal(matchResult.kind, "ok");
  if (matchResult.kind === "ok") {
    assert.equal(matchResult.value.comparisonsPerformed, 1);
    assert.equal(matchResult.value.matches.length, 1);
    assert.equal(matchResult.value.matches[0]?.decision.type, "confirmed");
    assert.equal(matchResult.value.matches[0]?.goldenRecord?.matchedCompanyId, "candidate-1");
  }

  const weakCandidate = makeCompany({
    id: "candidate-weak",
    name: "Apple Incorporated",
    country: "US",
    domain: "different.example"
  });
  const weakResult = await matcher.execute({
    sourceCompanies: [source],
    candidateCompanies: [weakCandidate]
  });
  assert.equal(weakResult.kind, "ok");
  if (weakResult.kind === "ok") {
    assert.equal(weakResult.value.matches.length, 0);
  }

  const invalidResult = await matcher.execute({
    sourceCompanies: [],
    candidateCompanies: [candidate]
  });
  assert.equal(invalidResult.kind, "err");

  console.log("company matcher checks passed");
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
