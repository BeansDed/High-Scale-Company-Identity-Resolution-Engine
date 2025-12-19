# High-Scale Company Identity Resolution Engine (Company Matcher)

A Clean Architecture TypeScript service that links duplicate company records across two datasets, even with missing fields and misspellings.

## File tree

```
.
├── Dockerfile
├── docker-compose.yml
├── package.json
├── prometheus.yml
├── tsconfig.json
└── src
    ├── application
    │   ├── ports
    │   │   ├── BlockingKeyFactory.ts
    │   │   └── SemanticCompanySearch.ts
    │   └── usecases
    │       └── MatchCompanies.ts
    ├── domain
    │   ├── company
    │   │   └── Company.ts
    │   ├── matching
    │   │   ├── CompanyIdentityLinker.ts
    │   │   ├── ConfidenceThreshold.ts
    │   │   ├── MatchDecision.ts
    │   │   └── MatchingStrategy.ts
    │   ├── record
    │   │   └── GoldenRecord.ts
    │   └── result
    │       └── Result.ts
    ├── infrastructure
    │   ├── blocking
    │   │   └── PrefixCountryBlockingKeyFactory.ts
    │   └── matching
    │       ├── DomainStrategy.ts
    │       ├── LevenshteinNameStrategy.ts
    │       └── TaxIdStrategy.ts
    └── presentation
        └── http
            ├── dto.ts
            └── server.ts
```

## Architecture (Clean Architecture)

- **Domain**: business language and decisions (`Company`, `CompanyIdentityLinker`, `MatchDecision`, `GoldenRecord`).
- **Application**: use cases + ports (`MatchCompanies`, `BlockingKeyFactory`, `SemanticCompanySearch`).
- **Infrastructure**: concrete strategies + blocking implementations (`LevenshteinNameStrategy`, `TaxIdStrategy`, `PrefixCountryBlockingKeyFactory`).
- **Presentation**: HTTP adapter (`POST /match`, `GET /metrics`).

This keeps matching logic independent of Express/DB/Redis/vector DB. Replacing Levenshtein with an embedding-based matcher later is a matter of swapping an adapter.

## Matching pipeline

1. **Blocking**: we compute a `blocking_key` (default: `COUNTRY:first3letters(normalizedName)`) so we only compare within the same block.
2. **Strategy scoring (Strategy Pattern)**:
   - `TaxIdStrategy` weight **100** (exact match)
   - `DomainStrategy` weight **60** (exact match on normalized domain)
   - `LevenshteinNameStrategy` weight **40** (edit-distance similarity)
3. **Decision**: scores are summed; if `score >= 120` we confirm the match.
4. **Golden Record**: on confirmed match, we merge the best available fields from both.

## Big-O complexity (why it scales)

Let:
- `N` = number of source records
- `M` = number of candidate records
- `B` = number of blocks
- `k` = average candidates per block (`k ≈ M / B`)

### Naive approach
- Comparing everything to everything is `O(N * M)` (often described as `O(n^2)` when `N ≈ M`).

### With blocking
- Build candidate block index: `O(M)`
- For each source record, compare only within its block: `O(N * k)`
- Total: `O(M + N * k)`

If blocking is effective, `k` stays small even when `M` is very large.

## Scaling to 1 million records

- **Tune blocking to reduce k**
  - Use multiple blocking keys per company (e.g., phonetic key, 3-gram signatures, country + city).
  - Maintain multiple indices and union candidates (still far less than all-pairs).
- **Two-stage retrieval**
  - Stage 1: blocking (cheap, deterministic)
  - Stage 2: semantic/vector search (optional port `SemanticCompanySearch`) to get top-K candidates when deterministic keys are missing.
- **Horizontal partitioning**
  - Partition work by blocking key prefix (`US:app`, `SG:goo`, etc.) across workers.
- **Caching**
  - Cache normalized forms and prior comparisons in Redis.
- **Vector DB integration**
  - Implement `SemanticCompanySearch` using Pinecone/Milvus.
  - Persist embeddings keyed by company id; query topK neighbors to avoid broad scans.
- **Observability**
  - Prometheus metrics at `/metrics`.
  - Use `rate(company_matches_confirmed_total[1m])` as “matches per second”.

## Running

### Local (Node)

```bash
npm install
npm run dev
```

### Docker Compose (App + Postgres + Redis + Prometheus)

```bash
docker compose up --build
```

- App: `http://localhost:8080`
- Metrics: `http://localhost:8080/metrics`
- Prometheus: `http://localhost:9090`

## Example request

`POST /match`

```json
{
  "sourceCompanies": [{"id":"a1","name":"Aple Inc","country":"US","domain":"apple.com"}],
  "candidateCompanies": [{"id":"b9","name":"Apple Incorporated","country":"US","domain":"www.apple.com"}]
}
```
