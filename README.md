# Welfare Data Australia

A search-first Australian welfare receipt and invoice generator. Covers nine selected welfare payment groups plus three aged-care service groups across 150 federal electorates and 547 ABS council/statistical local areas, with postcode choices, source recipient counts and estimated spending. Mobile uses search and a stacked document preview; this release has no map.

The programme toggle selects All welfare, Working-age & family support, or Retirement & aged care. It updates spending totals, per-person values, both rankings and downloads together, and persists in shared/QR links. These are programme-purpose groups, not actual recipient age bands; NDIS and Carer Payment can include older people. Age Pension was already included. The retirement group adds residential care, Home Care Packages and CHSP direct services. Rent Assistance is contextual in both groups and remains excluded from addition. Residential care can overlap NDIS reimbursements, so the All subtotal excludes it; retirement includes it because NDIS is outside that view. The two group totals therefore cannot simply be added together.

Current release `2024-25-v2` preserves every original observation in pinned `2024-25-v1` and adds audited aged-care estimates. Care counts use official ABS correspondence chains and are geographic estimates. Residential counts locate facilities; home-care counts locate recipients. CHSP clients cover the financial year; the other care counts are June snapshots. National spending is allocated using mapped GEN client shares as a proxy, with unknown addresses absent. Other aged-care programmes, administration and private fees are excluded. Missing records retain known partial counts/spending, clearly labelled, without gaining a complete rank. See [the aged-care audit](data/research-aged-care.md).

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

The frozen releases use FY2024–25 national programme expenditure, June2025 recipient snapshots (except annual CHSP), and June2024 ABS resident population on CED/LGA2024 boundaries. Local expenditure is an allocation estimate using recipient shares, rather than actual reported local payments. See [the source audit](data/source-audit.md), [spending evidence](data/research-spending.md), and [geography evidence](data/research-geography.md).

Recipient units are preserved: individuals, NDIS participants, FTB instalment families and CRA income units. Counts can overlap and are never summed into unique people. FTB lump-sum-only recipients are absent from its count population; that population is disclosed as an allocation proxy. Suppressed observations remain unavailable rather than being imputed.

Rent Assistance is embedded in primary programme expenditure. Its separate cross-program estimate is visible in every format but is excluded from subtotal addition to prevent double counting. Some CRA-paid programmes fall outside this selection.

NDIS council counts use the official ABS LGA2020→2021→2022→2023→2024 correspondences. Converted non-identity counts are estimates. Postcodes use common Mesh Block2021 memberships in the official POA2021/CED2024/LGA2024 allocation workbooks; this is an ABS statistical approximation and cannot assign a specific address with certainty.

## Rebuild and update sources

```sh
npm run data:acquire
```

Run `scripts/extract-workbooks.py` with a Python environment containing `openpyxl`, then run `npm run data:prepare`. The bundled Codex Python environment is supported. Raw files are cached under `.cache/sources/`; `data/source-manifest.json` records their URLs and SHA256 hashes. Clear only the intended cached input when deliberately acquiring a newer file.

Preserve existing published release files: a new financial year or corrected source requires a new release identifier, audited expenditure inputs and denominator dates. Receipt QR codes pin their original area and release. No automatic update schedule is configured.

`npm run data:aged-care` regenerates v2 from the frozen, checked-in `data/aged-care-counts-2025.json` and original v1. To re-extract the count input, acquire the exact sources recorded in `data/aged-care-source-manifest.json`, prepare the two documented legacy XLS correspondence CSVs, and run `scripts/extract-aged-care.py` using Python with openpyxl. The audit records geography chains, source hashes, mapped totals, exclusions and numerical residuals. Replace the frozen input only as part of a newly audited release.

## Verification and deployment

Unit tests exercise suppression, zero/missing counts, ABS ratio allocation, FTB overlap, CRA non-addition, period/population mismatches, ambiguous postcodes, leading zeros, pinned URLs and consistent document contents. Browser QA checked 320/375/430-pixel mobile widths and desktop, an electorate and a regional council, and both export formats. Eight generated PNG/PDF files were inspected via a temporary localhost capture because the in-app browser did not expose saved-download events; that capture was removed before publication. QR codes decoded to the exact pinned area URLs. Responsive-browser checks do not replace testing a physical phone or its software keyboard.

The final review fixes and verified-production-origin regression pass all 36 tests. A fresh checkout without `.cache/` successfully installs and builds. Browser regression checks confirm a missing population keeps the area invoice usable, while disabling per-resident downloads. The receipt/invoice text disclosure follows the selected style and matches the image. Detailed FTB Part A/B expenditure reconciles to its combined amount before rounding. Allocation metadata is validated at preparation and display, with incompatible estimates withheld and explained. Final QR links use the native deployment's verified production origin. See [the verification record](docs/verification.md) for decisions and limits.

The totals/rankings update passes 42 automated tests, including separate geography rankings, full-precision ties, incompatible/incomplete observations, CRA exclusion and production snapshot reconciliation. Browser checks cover national rank preservation under search, tab switching, pagination, selection of both complete and incomplete areas, and no overflow at 320/375/430 pixels. An independent read-only review found no critical or important issues. Its two minor findings were corrected: selecting an area retains the ranking page, and navigation uses the CSS reduced-motion preference.

The population-share update passes all 54 tests. New tests were observed failing before implementation and cover units, disjoint component combination, missing/zero/incompatible populations (including denominator dates), selected-payment eligibility, precision/ties, document parity and source-based Sydney arithmetic. The independent review identified one Important combined-rate export omission; that regression was reproduced, corrected and passes for both document styles. Browser checks confirm all ten payment-rate measures for both geography types, percentage and family-rate modes, per-payment eligibility, and no overflow at three phone widths. Eight actual browser-generated PNG/PDF files for Sydney and Armidale were captured through a temporary localhost QA hook, which was removed before publication. PDF layouts were visually inspected and the four PNG QR codes decoded to their pinned production URLs.

The search-dropdown update passes all 60 tests. Six new tests were observed failing before implementation, covering postcode prefixes, leading zeros, complete-postcode area choices, role aliases, invalid inputs and short-name matching without type-label overmatching. Browser QA verified a 5px gap below the field at desktop and 320/375/430px widths, a 375×430 small viewport, internal list scrolling, both area types, postcode 0800 transitions, keyboard selection/dismissal, outside clicks, empty results, retained load-error messages and pinned selected-area URLs. An independent review found no critical or important issues; its two minor dismissal issues were corrected and verified. Actual physical software-keyboard and screen-reader execution remain untested.

The per-person summary/rank update passes all 65 tests. Five new tests were first observed failing and cover population-normalised ordering, separate geography groups, incomplete/invalid denominators, precision/ties, CRA exclusion and receipt consistency. Browser checks confirm Sydney's $3,096/#145 of 150 divisions and Armidale's $8,380/#208 of 508 LGAs, matching their filtered ranking rows; Maralinga Tjarutja retains a known subtotal without rank. Summaries fit 320/375/430px widths without number or page overflow, and recipient-percentage modes still work. An independent review found no critical or important findings. Its two minor issues (unranked explanation and compare-link geography context) were corrected; the latter was reproduced and then checked in the browser.

### GitHub Pages

Public source: [adrasyn/au-welfare-data](https://github.com/adrasyn/au-welfare-data). Production domain: `https://auwelfaredata.wlsn.me`.

Push changes to `main` to publish. `.github/workflows/pages.yml` installs the locked dependencies, runs every test, rebuilds the local PDF/QR bundle and deploys only `dist/` to GitHub Pages. Pull requests run the same checks without deploying. Frozen data is checked in; publication does not acquire or change government source data. Configure the repository's Pages source as **GitHub Actions** and set the custom domain to `auwelfaredata.wlsn.me` in Pages settings; Actions deployments do not use `dist/CNAME` to configure that setting.

For DNS, add `auwelfaredata` as a **CNAME** pointing to `adrasyn.github.io` in the `wlsn.me` zone. Once GitHub validates DNS and issues its certificate, enable **Enforce HTTPS** in Pages settings. Share links and document QR codes use the custom production domain, so they require that DNS setup. The earlier owner-private Sites preview is separate and is no longer the publishing target for this checkout.

### Social link previews

`npm run build` generates a 1200×630 PNG and an HTML page for every area, frozen release and programme scope. The initial HTML contains Open Graph and X card metadata, so a preview fetch does not need to execute the application. The card shows the area name and the same annual dollars per resident used by the receipt, with geography, scope and financial year. Incomplete totals are labelled known/incomplete; missing population produces “Unavailable”, never zero. The homepage has a general branded card.

New share and QR links use `/area/{ced|lga}/{code}/{release}/{all|working|retirement}/`. Search selections update the address to that shareable path. Older `?area=...&release=...&scope=...` links still open their pinned area and become a path link after loading; because GitHub Pages cannot serve different HTML for query parameters, a crawler fetching the older query URL sees the general homepage preview. Use **Copy area link** for the area-specific card. Generated `dist/area/` and `dist/social/` assets are ignored in Git and regenerated by the deployment workflow. The card font is Atkinson Hyperlegible, bundled with its SIL Open Font Licence in `assets/social-fonts/`.

The programme-scope/aged-care update passes 81 tests, including source preservation, programme-specific allocation, annual dates, overlap handling, partial counts/spending, scope links and complete-only ranks. All ranks cover 139 divisions/497 LGAs, working-age ranks 150/508, and retirement ranks 133/493. Browser QA covers three mobile widths, both geography types, complete Armidale and incomplete Sydney, annual-care rankings, and search retaining the scope. Actual PNG/PDF exports were captured through a temporary localhost hook removed before publication. Long invoices retain readable type on multiple A4 pages; page boundaries and QR placement were visually checked. Physical phone keyboard and screen-reader execution remain untested.

## Attribution

Recipient statistics © Commonwealth of Australia, Department of Social Services; NDIS statistics © National Disability Insurance Agency; population, allocation and correspondence statistics © Australian Bureau of Statistics; aged-care counts from AIHW GEN and spending from the Department of Health and Aged Care's Operation of the Aged Care Act report; CRA expenditure from Productivity Commission Report on Government Services2026. Original source links are listed in the site. Follow the applicable source licences when reusing the source material; government logos are not reproduced.
