import express from "express";
import client from "prom-client";
import type { Request, Response } from "express";
import { CompanyIdentityLinker } from "../../domain/matching/CompanyIdentityLinker";
import { GoldenRecordFactory } from "../../domain/record/GoldenRecord";
import { MatchCompanies } from "../../application/usecases/MatchCompanies";
import { PrefixCountryBlockingKeyFactory } from "../../infrastructure/blocking/PrefixCountryBlockingKeyFactory";
import { DomainStrategy } from "../../infrastructure/matching/DomainStrategy";
import { LevenshteinNameStrategy } from "../../infrastructure/matching/LevenshteinNameStrategy";
import { TaxIdStrategy } from "../../infrastructure/matching/TaxIdStrategy";
import { mapCompanies, type CompanyDto } from "./dto";

const port = Number(process.env.PORT ?? 8080);

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const matchesTotal = new client.Counter({
  name: "company_matches_confirmed_total",
  help: "Total number of confirmed company matches"
});

const matchRequestsTotal = new client.Counter({
  name: "company_match_requests_total",
  help: "Total number of match requests processed"
});

register.registerMetric(matchesTotal);
register.registerMetric(matchRequestsTotal);

// A two-character country/name prefix keeps blocking cheap while still allowing
// small spelling mistakes such as "Aple" vs "Apple" to reach the scorer.
const blockingKeyFactory = new PrefixCountryBlockingKeyFactory(2);
const strategies = [new TaxIdStrategy(), new DomainStrategy(), new LevenshteinNameStrategy()];
const identityLinker = new CompanyIdentityLinker(strategies);
const goldenRecordFactory = new GoldenRecordFactory();

const matchCompanies = new MatchCompanies(blockingKeyFactory, identityLinker, goldenRecordFactory);

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get("/metrics", async (_req: Request, res: Response) => {
  res.setHeader("Content-Type", register.contentType);
  res.send(await register.metrics());
});

app.post("/match", async (req: Request, res: Response) => {
  matchRequestsTotal.inc();

  if (!Array.isArray(req.body?.sourceCompanies) || !Array.isArray(req.body?.candidateCompanies)) {
    res.status(400).json({
      error: {
        type: "InvalidRequest",
        message: "sourceCompanies and candidateCompanies must both be arrays"
      }
    });
    return;
  }

  const sourceDtos = req.body.sourceCompanies as CompanyDto[];
  const candidateDtos = req.body.candidateCompanies as CompanyDto[];

  const sourceMapped = mapCompanies(sourceDtos);
  if (sourceMapped.kind === "err") {
    res.status(400).json({ errors: sourceMapped.error });
    return;
  }

  const candidateMapped = mapCompanies(candidateDtos);
  if (candidateMapped.kind === "err") {
    res.status(400).json({ errors: candidateMapped.error });
    return;
  }

  const result = await matchCompanies.execute({
    sourceCompanies: sourceMapped.value,
    candidateCompanies: candidateMapped.value
  });

  if (result.kind === "err") {
    res.status(400).json({ error: result.error });
    return;
  }

  const confirmed = result.value.matches.filter((m) => m.decision.type === "confirmed").length;
  if (confirmed > 0) {
    matchesTotal.inc(confirmed);
  }

  res.json(result.value);
});

app.listen(port, () => {
  console.log(`company-matcher listening on :${port}`);
});
