# High-Scale Company Identity Resolution Engine

A TypeScript service for linking duplicate company records across noisy datasets while keeping the matching rules isolated from HTTP, storage, and infrastructure concerns.

The project is built around **Clean Architecture**, deterministic blocking, weighted matching strategies, golden-record creation, Docker, and Prometheus metrics.

## What It Demonstrates

- Clean separation between domain, application, infrastructure, and HTTP layers
- Candidate blocking to avoid full `N × M` comparisons
- Deterministic company-name, domain, and tax-ID normalization
- Weighted matching strategies that can be replaced independently
- Golden-record generation after a confirmed match
- Prometheus observability
- Reproducible Docker builds
- Automated build and matcher checks

## Matching Pipeline

### 1. Normalize identity fields

Before scoring, the service normalizes the fields that commonly vary between datasets:

- company names are lowercased, punctuation-normalized, and common legal suffixes such as `Inc`, `LLC`, `Ltd`, and `Corporation` are removed
- domains are normalized by removing protocol, `www`, common ports, paths, and trailing dots
- tax IDs are compared without punctuation, spaces, or casing differences

For example:

```text
Aple Inc            -> aple
Apple Incorporated  -> apple
https://www.apple.com:443/about -> apple.com
12-345 6789         -> 123456789
```

### 2. Block candidates

The default blocking key is:

```text
COUNTRY:first2letters(normalizedName)
```

That means both `Aple Inc` and `Apple Incorporated` land in `US:ap`, so a small spelling error does not prevent the records from reaching the scorer.

Blocking keeps the common path closer to:

```text
O(M + N × k)
```

where `k` is the average number of candidates inside a block, instead of comparing every source record to every candidate.

### 3. Score evidence

| Strategy | Maximum points | Meaning |
|---|---:|---|
| Exact normalized tax ID | 120 | Decisive identity evidence |
| Exact normalized domain | 100 | Strong identity evidence |
| Levenshtein name similarity | 40 | Supporting fuzzy-name evidence |

A match is confirmed when the total score reaches **120**.

This lets a normalized tax-ID match confirm directly, while an exact domain can combine with a strong fuzzy-name match.

### 4. Create a golden record

Confirmed records are merged into a golden record that preserves the source and matched IDs while selecting the best available values from both records.

## Example

`POST /match`

```json
{
  "sourceCompanies": [
    {
      "id": "a1",
      "name": "Aple Inc",
      "country": "US",
      "domain": "https://apple.com"
    }
  ],
  "candidateCompanies": [
    {
      "id": "b9",
      "name": "Apple Incorporated",
      "country": "US",
      "domain": "www.apple.com"
    }
  ]
}
```

The two records share the same blocking key, the domain contributes strong evidence, and the fuzzy company-name score pushes the result over the confirmation threshold.

## API

### `GET /health`

Returns a lightweight liveness response.

```json
{ "ok": true }
```

### `GET /metrics`

Returns Prometheus-formatted application and Node.js metrics.

Custom counters include:

- `company_match_requests_total`
- `company_matches_confirmed_total`

### `POST /match`

Accepts `sourceCompanies` and `candidateCompanies` arrays. Invalid payload shapes or invalid company fields return HTTP `400` responses.

## Project Structure

```text
src/
├── application/
│   ├── ports/
│   │   ├── BlockingKeyFactory.ts
│   │   └── SemanticCompanySearch.ts
│   └── usecases/
│       └── MatchCompanies.ts
├── domain/
│   ├── company/
│   │   └── Company.ts
│   ├── matching/
│   │   ├── CompanyIdentityLinker.ts
│   │   ├── ConfidenceThreshold.ts
│   │   ├── MatchDecision.ts
│   │   └── MatchingStrategy.ts
│   ├── record/
│   │   └── GoldenRecord.ts
│   └── result/
│       └── Result.ts
├── infrastructure/
│   ├── blocking/
│   │   └── PrefixCountryBlockingKeyFactory.ts
│   └── matching/
│       ├── DomainStrategy.ts
│       ├── LevenshteinNameStrategy.ts
│       └── TaxIdStrategy.ts
└── presentation/
    └── http/
        ├── dto.ts
        └── server.ts
```

## Run Locally

Requirements:

- Node.js 20+
- npm

```bash
npm ci
npm run check
npm run dev
```

The API starts on:

```text
http://localhost:8080
```

## Verification

Run the complete local verification command:

```bash
npm run check
```

That command:

1. compiles the TypeScript project with strict settings
2. runs matcher checks covering normalization, typo-tolerant blocking, tax-ID matching, fuzzy/domain matching, golden-record creation, and invalid requests

A GitHub Actions workflow also runs the same verification on pushes and pull requests to `main` when Actions are available for the account.

## Docker + Prometheus

Start the API and Prometheus together:

```bash
docker compose up --build
```

Services:

- API: `http://localhost:8080`
- Prometheus: `http://localhost:9090`

The container build uses `npm ci`, separates build and production dependencies, runs as the non-root Node user, and includes a `/health` container health check.

## Current Scope

The current matcher is intentionally **in-memory**. PostgreSQL and Redis are not presented as implemented persistence layers in this version.

The architecture already exposes ports and boundaries where production-scale infrastructure can be introduced without moving matching rules into Express or a database adapter.

## Scaling Path

For substantially larger datasets, the next steps would be:

- use multiple blocking keys such as phonetic signatures, country/city combinations, or n-gram keys
- partition blocks across workers
- persist normalized records and blocking indexes
- cache repeated normalization/comparison work
- implement the existing `SemanticCompanySearch` port with a vector-search adapter for records that cannot be blocked deterministically
- measure block size, comparisons per request, latency, and confirmed-match rate through Prometheus

The goal is to keep scaling concerns in adapters and orchestration while preserving domain matching rules as independently testable code.
