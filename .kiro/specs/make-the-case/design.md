# Design: make-the-case

## Where it sits on the page

```
Hero (existing)                      ← service picker, the answer
CaseLookup (new, #my-case)           ← MC-02..MC-07
Map, survival, outcomes, table (existing, unchanged)
Cambridge (new, #cambridge)          ← MC-08
Method (existing) + footer
```

## Data layer

`src/lib/stats.ts` gains one pure function; nothing else in that file changes.

```ts
export function survivalAt(km: KMResult, hours: number): number // S(t), right-continuous
export function conditionalClose(km: KMResult, ageHours: number, windowHours: number,
                                 horizonHours: number): number | null
```

`src/lib/boston311.ts`:

```ts
export const CASE_ID_PATTERN = /^BCS-\d{8}$/
export function parseCaseId(input: string): string | null
export interface CaseRecord { case_id, service_name, case_status, closure_reason,
  open_date, close_date, target_close_date, city_council_district }
export async function fetchCase(caseId: string): Promise<CaseRecord | null>
```

`fetchCase` re-checks `CASE_ID_PATTERN` itself and throws on a bad ID, so no caller can bypass
validation. It selects only the columns above.

`src/lib/cambridge311.ts` (Socrata SoQL, `https://data.cambridgema.gov/resource/2z9k-mv9g.json`,
CORS-open, no key):

```ts
export async function fetchCambridgeCutoff(): Promise<number>    // max of created/closed/updated
export async function fetchCambridgeTypes(min = 200): Promise<{ issueType, n }[]>
export async function fetchCambridgeRows(issueType: string): Promise<CambridgeRow[]>
export function toCambridgeObservations(rows, censorAt): { obs, excludedNoCloseTime }
```

SoQL string values are quoted with doubled single quotes. Cambridge timestamps are floating
(no zone) and are read as UTC on both ends, so durations are right; displayed dates are local.

`src/data/caseLookup.ts` builds the view model: case facts, the service audit (reused from
`loadServiceAudit`), the conditional chance and the summary text. `src/data/cambridge.ts`
caches per issue type.

## Similar cases

"Similar" = same service, still under observation past the case's age (`hours > age`). The count
comes from the observations, and the chance comes from the Kaplan–Meier curve the existing survival
chart draws. The horizon is the longest observed duration for the service.

## Summary request

| Case | Request line |
| --- | --- |
| open, past target | Please give a completion date for this case. |
| open, before target | Please confirm it is still on track for the target date. |
| closed, Transitioned | Please confirm which agency now has this case. |
| closed, Noted | Please confirm what was decided on this request. |
| closed, other | (none) |

## Components

- `CaseLookup.tsx`: form (`<label>`, `<input inputMode="text" autoComplete="off">`, submit
  button), inline error with `aria-describedby`, result card, summary `<pre>`-style block and copy
  button. The status line uses `aria-live="polite"`.
- `Cambridge.tsx`: a native `<select>` for issue type (33 Boston chips are already a lot; a select
  scales and is keyboard-native), two numbers with the same comparison-bar treatment as the hero,
  the excluded-ticket count, and the source line.

## Testing

- `src/lib/stats.conditional.test.ts`: the fast-check properties in MC-05.
- `src/lib/conditionalGolden.test.ts`: TypeScript `conditionalClose` matches the Python grid in
  `__fixtures__/conditional-golden.json` (written by `check_make_the_case.py --golden`) to 1e-9.
- `src/lib/caseId.test.ts`: `parseCaseId` accepts only well-formed IDs (fast-check over arbitrary
  strings) and normalises case and whitespace.
- `src/lib/cambridge311.test.ts`: `toCambridgeObservations` status mapping and exclusion count.
- End: `check_make_the_case.py` live, then `--compare` on figures scraped from the built page.
