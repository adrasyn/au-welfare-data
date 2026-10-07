# Benefits Data Australia

A search-first Australian benefit receipt and invoice generator. Covers nine selected benefit groups across 150 federal electorates and 547 ABS council/statistical local areas, with postcode choices, source recipient counts and estimated spending. Mobile uses search and a stacked document preview; this release has no map.

## Run locally

```sh
npm ci
npm run build
npm run dev
```

Open the printed `http://127.0.0.1:4173` URL. `npm test` runs the data, calculation, search, export-model and source-regression checks.

The `dist/` directory is the complete static website. PDF and QR dependencies are bundled locally; no CDN or live government API is required by a visitor. PNG and PDF are generated from the same document model. Prepared save links remain available if the browser does not start an automatic download.

## Data and meaning

The frozen release `2024-25-v1` uses FY2024–25 national programme expenditure, June2025 recipient snapshots, and June2024 ABS resident population on CED/LGA2024 boundaries. Local expenditure is an allocation estimate using recipient shares, rather than actual reported local payments. See [the source audit](data/source-audit.md), [spending evidence](data/research-spending.md), and [geography evidence](data/research-geography.md).

Recipient units are preserved: individuals, NDIS participants, FTB instalment families and CRA income units. Counts can overlap and are never summed into unique people. FTB lump-sum-only recipients are absent from its count population; that population is disclosed as an allocation proxy. Suppressed observations remain unavailable rather than being imputed.

Rent Assistance is embedded in primary programme expenditure. Its separate cross-program estimate is visible in every format but is excluded from subtotal addition to prevent double counting. Some CRA-paid programmes fall outside this selection.

NDIS council counts use the official ABS LGA2020→2021→2022→2023→2024 correspondences. Converted non-identity counts are estimates. Postcodes use common Mesh Block2021 memberships in the official POA2021/CED2024/LGA2024 allocation workbooks; this is an ABS statistical approximation and cannot assign a specific address with certainty.

## Rebuild and update sources

```sh
npm run data:acquire
```

Run `scripts/extract-workbooks.py` with a Python environment containing `openpyxl`, then run `npm run data:prepare`. The bundled Codex Python environment is supported. Raw files are cached under `.cache/sources/`; `data/source-manifest.json` records their URLs and SHA256 hashes. Clear only the intended cached input when deliberately acquiring a newer file.

Preserve existing published release files: a new financial year or corrected source requires a new release identifier, audited expenditure inputs and denominator dates. Receipt QR codes pin their original area and release. No automatic update schedule is configured.

## Verification and deployment

Unit tests exercise suppression, zero/missing counts, ABS ratio allocation, FTB overlap, CRA non-addition, period/population mismatches, ambiguous postcodes, leading zeros, pinned URLs and consistent document contents. Browser QA checked 320/375/430-pixel mobile widths and desktop, an electorate and a regional council, and both export formats. Eight generated PNG/PDF files were inspected via a temporary localhost capture because the in-app browser did not expose saved-download events; that capture was removed before publication. QR codes decoded to the exact pinned area URLs. Responsive-browser checks do not replace testing a physical phone or its software keyboard.

The final review fixes and verified-production-origin regression pass all 36 tests. A fresh checkout without `.cache/` successfully installs and builds. Browser regression checks confirm a missing population keeps the area invoice usable, while disabling per-resident downloads. The receipt/invoice text disclosure follows the selected style and matches the image. Detailed FTB Part A/B expenditure reconciles to its combined amount before rounding. Allocation metadata is validated at preparation and display, with incompatible estimates withheld and explained. Final QR links use the native deployment's verified production origin. See [the verification record](docs/verification.md) for decisions and limits.

`.openai/hosting.json` points to the owner-private Sites project. Publication uses the native Sites source helper and a saved version of the exact pushed source. Keep the audience private until the owner requests public access.

## Attribution

Recipient statistics © Commonwealth of Australia, Department of Social Services; NDIS statistics © National Disability Insurance Agency; population, allocation and correspondence statistics © Australian Bureau of Statistics; CRA expenditure from Productivity Commission Report on Government Services2026. Original source links are listed in the site. Follow the applicable source licences when reusing the source material; government logos are not reproduced.
