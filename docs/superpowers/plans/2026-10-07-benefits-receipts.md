# Benefits Receipts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Australian area search and receipt/invoice generator showing recipient counts and spending for the seven approved benefit groups, with PNG and PDF downloads.

**Architecture:** A static HTML/CSS/JavaScript application consumes a validated, versioned JSON data snapshot. Pure calculation functions produce a shared export model used by the accessible page, preview and browser downloads. Offline acquisition scripts record the source evidence; visitors do not depend on live government APIs.

**Tech Stack:** Native JavaScript ES modules, Node's built-in test runner, Canvas 2D for PNG rendering, locally bundled jsPDF and qrcode for PDF and QR generation, and Sites static hosting. Pin library versions when installing; no visitor database, account system or scheduled jobs.

**Spec:** ../specs/2026-10-07-benefits-receipts-design.md

## Global Constraints

- “Total” always means **these seven selected benefit groups**, not all Australian welfare spending.
- DSP and Age Pension are included alongside the original five groups. Other proposed additions require the user's scope decision.
- Mobile is explicitly search-first: show the postcode/electorate/council search, labelled area choices, summary and downloads, with no map.
- Plan budgets are not spending.
- Counts are a primary part of the page and both export styles, not hidden only in a detail panel.
- Never sum recipient counts across benefit groups or imply that these are unique individuals.
- Never treat missing or suppressed values as zero.
- Do not mix financial years inside a total.
- Use the same validated data and arithmetic for the page, preview and both downloadable formats.
- Calculate totals from unrounded amounts, then round for display; include a rounding note.
- No automatic refresh schedule is created in this release.
- New Sites remain owner-private until the user requests broader access.

## Review Focus

1. FTB A/B overlap: both counts must survive in every output, with no combined family count.
2. Suppressed NDIS counts: `<11` stays suppressed, cannot become 11, zero or a precise spending allocation.
3. Postcodes crossing electorate/council boundaries: return explicit choices, including state and geography type.
4. Rent Assistance embedded in another expenditure: complete totals require evidence that overlapping amounts are removed.
5. Geography/period mismatch: incompatible population or payment inputs must disable the affected computation and explain why.

These five cases are pinned in the owning tasks below. Synthetic fixture values are used only in tests, never shipped as government data.

---

## File responsibilities and data interfaces

- `scripts/acquire-data.mjs`: fetch and cache published source files; record URLs, release dates and checksums.
- `scripts/prepare-data.mjs`: normalise counts, spending, population and area/postcode concordances; emit the validated snapshot.
- `data/source-manifest.json`: reproducible inputs, geography definitions, units, financial periods and calculation evidence.
- `data/source-audit.md`: source definitions, expenditure/CRA overlap determination and verified coverage.
- `dist/data/releases/<release-id>.json`: production snapshot containing only supported records and explicit unavailable states.
- `dist/index.html`, `dist/styles.css`, `dist/app.mjs`: accessible responsive page and interaction state.
- `dist/lib/model.mjs`: pure calculation and export-model functions.
- `dist/lib/search.mjs`: area/postcode matching.
- `dist/lib/render.mjs`: receipt/invoice layout using a small shared drawing interface.
- `dist/lib/download.mjs`: PNG/PDF/QR generation and browser download handling.
- `tests/model.test.mjs`, `tests/search.test.mjs`, `tests/data.test.mjs`: business-data and search tests.
- `.openai/hosting.json`: native Sites identity and static deployment directory.
- `package.json`, `package-lock.json`, `.gitignore`, `README.md`: runtime/dependency reproducibility and local operation.

Every source quantity uses this serialisable shape:

```js
// value is null for unavailable or suppressed observations.
const quantity = {
  value: 42,
  displayBound: null,
  status: 'reported', // reported | estimated | suppressed | unavailable
  unit: 'people', // people | participants | families | income-units | AUD
  period: '2026-06-30',
  sourceId: 'dss-june-2026',
  geographyVintage: 'LGA2024'
};
```

An area contains `id`, `name`, `state`, `type` (`lga` or `ced`), `postcodes`, `geographyVintage`, `population`, and `groups`. Each group has `id`, `label`, `counts` (labelled component observations), `spending`, `financialYear`, and `excludesRentAssistance`. The release contains `id`, `areas`, `sources`, `methodology`, and `publishedAt`.

`buildSummary(area)` returns `{ area, groups, total, totalLabel, perResidentAvailable, notes }`. It does not return an aggregate recipient count. `searchAreas(query, areas)` returns matching area records without selecting one implicitly. `renderGraphic(summary, style, draw, qr)` consumes only the shared summary; `style` is `receipt` or `invoice`. `exportGraphic(summary, style, format, canonicalUrl)` returns a `Promise<Blob>`; `format` is `png` or `pdf`.

### Task 1: Acquire and validate the real data

**Files:** `scripts/acquire-data.mjs`, `scripts/prepare-data.mjs`, `data/source-manifest.json`, `data/source-audit.md`, `tests/data.test.mjs`, `package.json`, `.gitignore`.

**Interfaces:** Produce the release shape above. Acquisition failures must preserve the previous valid snapshot. Preparation rejects incompatible years, duplicate area IDs and unlabeled source quantities.

- [ ] Establish Node availability and initialise a repository if none exists. Set `type: module` and scripts `test: node --test`, `data:acquire: node scripts/acquire-data.mjs`, `data:prepare: node scripts/prepare-data.mjs`, and `preview: node scripts/serve.mjs`. Ignore caches, node_modules and generated archives.
- [ ] Acquire DSS quarterly count files through the CKAN `package_show` API for `dss-payments-by-local-government-area` and `dss-payments-by-commonwealth-electoral-division`. Include the `Disability Support Pension` and `Age Pension` fields alongside the original five groups. Use `dss-payment-demographic-data` for source definitions and snapshot-date national denominators. Read applicable spreadsheet/document skills before parsing XLSX/DOCX inputs.
- [ ] Acquire NDIS participant LGA/CED files and payment amounts from the official datasets pages. Read accompanying definitions to determine payment reporting periods, suppression, aggregate rows and count populations. Keep source geography vintages intact.
- [ ] Obtain independently reported national spending inputs for the latest complete common financial year from official DSS/NDIA financial publications. Record exact table/page references, units and whether CRA is embedded. Do not use maximum entitlement rates as average spending. Choose only a year whose required allocations can be supported; preserve unavailable statuses otherwise.
- [ ] Acquire ABS population and verified postcode/geography concordances. Prefer exact codes; require a recorded mapping for NDIS LGA2020 to DSS LGA2024. Name matching alone is insufficient for changed boundaries.
- [ ] Write `validateRelease(release)` and test these failures before implementing preparation:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRelease } from '../scripts/prepare-data.mjs';
test('duplicate IDs are rejected', () => {
  assert.throws(() => validateRelease({ id: 'test', sources: [], areas: [
    { id: 'lga:1' }, { id: 'lga:1' }
  ] }), /duplicate/i);
});
test('suppression cannot contain an exact numeric value', () => {
  assert.throws(() => validateRelease({ id: 'test', sources: [], areas: [{
    id: 'ced:1', groups: [{ counts: [{
      status: 'suppressed', value: 11, displayBound: '<11', unit: 'participants'
    }] }]
  }] }), /suppressed/i);
});
```

- [ ] Implement input parsing and audit output with source checksums, exact units, component breakdowns and boundary mappings. Run `npm run data:acquire`, `npm run data:prepare`, then `node --test tests/data.test.mjs`. Spot-check at least one metro and one regional LGA and CED against each original source.
- [ ] Save the source audit and commit the validated ingestion change. Record unsupported records explicitly instead of inventing data.

### Task 2: Calculation model with recipient counts

**Files:** `dist/lib/model.mjs`, `tests/model.test.mjs`.

**Interfaces:** Consume area records from Task 1 and produce `buildSummary(area)` as defined above. Produce `formatCount(observation)` and `formatAUD(value)` used by the UI and renderer.

- [ ] Write failing tests for unrounded totals, source-unit labels, suppressed counts, population mismatch and CRA overlap. Include this numerical core:

```js
test('FTB component counts remain distinct', () => {
  const group = { id: 'ftb', label: 'Family Tax Benefit', counts: [
    { label: 'Part A', value: 100, unit: 'families', status: 'reported' },
    { label: 'Part B', value: 80, unit: 'families', status: 'reported' }
  ], spending: { value: 1000, status: 'estimated', unit: 'AUD' },
  financialYear: '2024-25', excludesRentAssistance: true };
  const result = buildSummary({ id: 'lga:test', groups: [group],
    population: { value: 10, geographyVintage: 'LGA2024' }, geographyVintage: 'LGA2024' });
  assert.equal(result.groups[0].counts.length, 2);
  assert.equal(Object.hasOwn(result, 'totalPeople'), false);
});
test('a suppressed count preserves its published bound', () => {
  assert.match(formatCount({ value: null, displayBound: '<11',
    status: 'suppressed', unit: 'participants' }), /<11.*participants/);
});
```

- [ ] Run `node --test tests/model.test.mjs` and confirm the tests fail for missing functions. Implement pure summary/calculation functions and explicit unavailable reasons. Sum monetary observations only when periods and non-overlap evidence agree; never sum overlapping counts.
- [ ] Derive per-resident values only from compatible, positive population. Add tests showing unavailable spending causes a subtotal, CRA overlap prevents a complete total, and mixed financial years cannot be added. Run `npm test` and commit the calculation model.

### Task 3: Search and pinned area URLs

**Files:** `dist/lib/search.mjs`, `tests/search.test.mjs`, `scripts/serve.mjs`.

**Interfaces:** Consume release areas and return `searchAreas(query, areas)`. `resolveAreaUrl(url, releases)` resolves exact release and area identifiers or returns a user-readable unavailable state.

- [ ] Write and run this failing ambiguity test:

```js
test('a postcode returns every intersecting area', () => {
  const areas = [
    { id: 'lga:a', name: 'Alpha', state: 'NSW', type: 'lga', postcodes: ['2000'] },
    { id: 'ced:b', name: 'Beta', state: 'NSW', type: 'ced', postcodes: ['2000'] }
  ];
  assert.deepEqual(searchAreas('2000', areas).map(a => a.id), ['lga:a', 'ced:b']);
});
```

- [ ] Implement trimmed, case-insensitive name matching and strict four-digit postcode handling without converting postcodes to numbers. Include state/type in result labels, retain ACT/unincorporated source areas and give no-match/invalid-input messages.
- [ ] Test duplicate names in different states, whitespace, invalid postcodes and unknown release IDs. Implement the local static server with path traversal protection and correct ES-module MIME types. Run `node --test tests/search.test.mjs`, then commit search and URL handling.

### Task 4: Accessible page and document previews

**Files:** `dist/index.html`, `dist/styles.css`, `dist/app.mjs`, `dist/lib/render.mjs`.

**Interfaces:** Consume the release, search results and `buildSummary`. Renderer uses `draw.text`, `draw.line`, `draw.rect`, `draw.image` and measured text width to create both styles without recalculating money or counts.

- [ ] Read applicable design skills, choose the accent palette, and implement the focused light interface: labelled postcode/electorate/council search, explicit area choices, date/source information, seven-group summary and receipt/invoice switch. Use a single-column search-first flow on mobile without a map. Stack the summary and document preview; keep page content within viewport width and use touch-friendly controls.
- [ ] Put count components directly beneath each receipt benefit line and in a dedicated invoice count column. Preserve FTB A/B and Youth Allowance categories, source units, count dates and suppression. Include counts in the accessible DOM and Canvas previews.
- [ ] Implement the drawing adapters using this shared model contract:

```js
export function renderGraphic(summary, style, draw, qr) {
  const rows = summary.groups.map(group => ({
    label: group.label,
    counts: group.counts.map(count => ({ label: count.label, observation: count })),
    money: style === 'receipt' ? group.perResident : group.spending
  }));
  return draw.document({ style, area: summary.area, rows,
    total: summary.total, totalLabel: summary.totalLabel, notes: summary.notes, qr });
}
```

- [ ] Add loading, no-match, multiple-choice, missing-population, suppressed-count and unavailable-spending states. Use semantic buttons and live status text; restore focus sensibly when area selection changes. Keep financial-year and count-date labels separate.
- [ ] Start the preview under the Sites local-preview instructions. Check mobile at 320, 375 and 430 CSS-pixel widths and desktop in the supported browser: postcode and area-name search, keyboard navigation, state/type labels, long area names, document wrapping and all seven count groups. Check small-screen input focus/software keyboard and both downloads, not only a screenshot. Confirm `document.documentElement.scrollWidth <= window.innerWidth` using the read-only browser DOM check. Commit the page and previews after observed failures are fixed.

### Task 5: PNG/PDF downloads and QR links

**Files:** `dist/lib/download.mjs`, `dist/vendor/`, `package.json`, `package-lock.json`.

**Interfaces:** `exportGraphic(summary, style, format, canonicalUrl)` returns a Blob using the same renderer as Task 4. Count observations remain identical across all formats.

- [ ] Read PDF skills before generating/inspecting PDF artifacts; install pinned jsPDF and qrcode from the reputable npm registry, then bundle them locally into static assets.
- [ ] Render PNG at sufficient resolution for legible count labels. Render receipt and invoice to PDF with the same content and layout; include QR links pointing to the deployment URL with release/area identifiers. Use filenames containing area type, name, style and release.
- [ ] Implement download lifecycle and explicit failure recovery:

```js
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] For one real LGA and one real CED, download both styles in both formats. Open and visually inspect PNG/PDF files, compare counts/amounts/dates against the page and source snapshot, test QR resolution and verify readable source notes. Do not rely only on a successful download event.
- [ ] Force one export failure and confirm the selected area, summary and preview persist with a retry action. Commit exports after verification.

### Task 6: Verify, package and privately deploy

**Files:** `.openai/hosting.json`, `README.md`, source snapshot, all preceding files.

**Interfaces:** Produce a verified owner-private deployment URL and a source-backed saved version using the native Sites workflow.

- [ ] Run `npm test` and data validation against the production snapshot. Reconcile representative source records and all five review-focus cases. Perform mobile/desktop browser checks for search, all seven categories and their counts, both styles and four download combinations. Include an electorate and an LGA at each of the three specified mobile widths.
- [ ] Register the Site once only, persist its returned identity, and set the static directory to `dist`. Use the native Sites source helper to commit/push and package the exact validated source state. Credentials go through stdin only, never files or command arguments.
- [ ] Deploy via the owner-private native operation, preserving access. If deployment is non-terminal, poll status to completion. Use the deployed canonical URL for QR links, rebuild exports if necessary, and verify that links remain pinned to the release.
- [ ] Document source-refresh commands, estimation assumptions and verified coverage in README. Provide the deployed URL and disclose any specific unavailable values or verification limits. Do not claim the site reports actual local spending where it estimates distribution.

## Recommended execution

Native execution in this chat is recommended. Data definitions, calculations, renderers and exports depend closely on the same interfaces, so one implementer can carry verified source meaning through every output. A final independent review should focus on recipient units, allocation assumptions, CRA overlap and page/export agreement.
