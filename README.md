# Benefits Data Australia

A search-first Australian benefit receipt and invoice generator. Covers nine selected benefit groups across 150 federal electorates and 547 ABS council/statistical local areas, with postcode choices, source recipient counts and estimated spending. Mobile uses search and a stacked document preview; this release has no map.

Area search uses a dropdown anchored directly beneath the field, with explicit Postcode, Division and LGA badges. Two/three-digit postcode prefixes offer postcode suggestions; choosing a postcode opens its matching divisions and LGAs in the same dropdown. Four-digit postcodes directly show all matching areas with postcode context. A postcode is a lookup route, not a monetary reporting area. Results scroll within the dropdown and its height follows the available viewport, including visual-viewport resize events. Arrow keys, Enter, Escape, Tab, pointer selection and outside dismissal are supported through a combobox/listbox pattern.

Each selected area now shows its estimated total annual spending and its national rank within its area type. The spending rankings compare federal divisions and LGAs separately, highest first, with name/state/postcode search and pagination. Filters retain national ranks. Exact unrounded ties share a competition rank. All 150 divisions and 508 of 547 LGAs have complete estimates; the other 39 LGAs are visible with known subtotals and no rank, because one or more programme amounts are missing or suppressed. CRA is excluded from addition throughout.

The top summary also shows estimated annual spending per person and its separate national rank. This divides the same annual programme total by all residents, including children, using the dated compatible ABS population. Choose “Annual spending per person” in the rankings selector to compare divisions or LGAs. Known incomplete per-person subtotals remain labelled and unranked; a missing, zero or incompatible population produces no per-person estimate/rank. Values match the existing receipt total, display whole AUD, and retain full precision for ranking. Summary comparison links restore the selected area's geography and clear unrelated ranking filters.

Population and recipient rates now appear beside each payment and in PNG/PDF downloads. People and NDIS participants are shown as a percentage of all residents. FTB Part A/B families and CRA income units use a rate per 1,000 residents, rather than a percentage of people; A/B are kept separate because family counts overlap. Youth Allowance and Parenting Payment combine their separate individual categories for payment-level rankings and also retain the component rates. The “Rank by” selector compares any of these rates separately for divisions and LGAs, using unrounded rates and requiring only the selected payment's complete compatible counts and a positive compatible population. Payment percentages are never added into a unique overall welfare-receipt percentage.

Rates divide the June2025 recipient snapshot by ABS June2024 population on matching 2024 boundaries. Dates are visible, all residents including children form the denominator, and rates are approximate rather than eligibility rates. Population changes, DSS rounding and correspondence estimates affect the interpretation. Positive rates below 0.1 are shown as “<0.1” instead of a false zero; zero remains 0.0.

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

The totals/rankings update passes 42 automated tests, including separate geography rankings, full-precision ties, incompatible/incomplete observations, CRA exclusion and production snapshot reconciliation. Browser checks cover national rank preservation under search, tab switching, pagination, selection of both complete and incomplete areas, and no overflow at 320/375/430 pixels. An independent read-only review found no critical or important issues. Its two minor findings were corrected: selecting an area retains the ranking page, and navigation uses the CSS reduced-motion preference.

The population-share update passes all 54 tests. New tests were observed failing before implementation and cover units, disjoint component combination, missing/zero/incompatible populations (including denominator dates), selected-payment eligibility, precision/ties, document parity and source-based Sydney arithmetic. The independent review identified one Important combined-rate export omission; that regression was reproduced, corrected and passes for both document styles. Browser checks confirm all ten payment-rate measures for both geography types, percentage and family-rate modes, per-payment eligibility, and no overflow at three phone widths. Eight actual browser-generated PNG/PDF files for Sydney and Armidale were captured through a temporary localhost QA hook, which was removed before publication. PDF layouts were visually inspected and the four PNG QR codes decoded to their pinned production URLs.

The search-dropdown update passes all 60 tests. Six new tests were observed failing before implementation, covering postcode prefixes, leading zeros, complete-postcode area choices, role aliases, invalid inputs and short-name matching without type-label overmatching. Browser QA verified a 5px gap below the field at desktop and 320/375/430px widths, a 375×430 small viewport, internal list scrolling, both area types, postcode 0800 transitions, keyboard selection/dismissal, outside clicks, empty results, retained load-error messages and pinned selected-area URLs. An independent review found no critical or important issues; its two minor dismissal issues were corrected and verified. Actual physical software-keyboard and screen-reader execution remain untested.

The per-person summary/rank update passes all 65 tests. Five new tests were first observed failing and cover population-normalised ordering, separate geography groups, incomplete/invalid denominators, precision/ties, CRA exclusion and receipt consistency. Browser checks confirm Sydney's $3,096/#145 of 150 divisions and Armidale's $8,380/#208 of 508 LGAs, matching their filtered ranking rows; Maralinga Tjarutja retains a known subtotal without rank. Summaries fit 320/375/430px widths without number or page overflow, and recipient-percentage modes still work. An independent review found no critical or important findings. Its two minor issues (unranked explanation and compare-link geography context) were corrected; the latter was reproduced and then checked in the browser.

`.openai/hosting.json` points to the owner-private Sites project. Publication uses the native Sites source helper and a saved version of the exact pushed source. Keep the audience private until the owner requests public access.

## Attribution

Recipient statistics © Commonwealth of Australia, Department of Social Services; NDIS statistics © National Disability Insurance Agency; population, allocation and correspondence statistics © Australian Bureau of Statistics; CRA expenditure from Productivity Commission Report on Government Services2026. Original source links are listed in the site. Follow the applicable source licences when reusing the source material; government logos are not reproduced.
