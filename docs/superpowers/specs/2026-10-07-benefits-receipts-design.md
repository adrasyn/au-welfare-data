# Benefits Data Australia: receipt-first release

Date: 7 October 2026
Status: approved on 7 October 2026; recipient counts, mobile search, DSP and Age Pension added by the user

## Purpose and agreed scope

Help the general public explore welfare spending in their Australian federal electorate or local government area and download a clear, shareable summary. The primary launch feature is a receipt/invoice generator inspired by benefitsdata.uk/mybill. Interactive maps and the other UK homepage features are later work.

The user approved the journey: search postcode or area, choose electorate or council area, preview, download. They requested these seven benefit groups:

| Group | Included components |
| --- | --- |
| JobSeeker (formerly Newstart) | Current JobSeeker Payment. Search recognises “Newstart”; historical Newstart trends are outside this release. |
| Youth Allowance | Other, and student and apprentice categories. Keep the components separate in the detailed breakdown and combine their spending in the export. |
| NDIS | NDIS support payments; use participant counts as context. Plan budgets are not spending. |
| Family Tax Benefit | Parts A and B; keep component spending separate in the detailed breakdown. |
| Commonwealth Rent Assistance | The rent assistance component, separated from the underlying payment. |
| Disability Support Pension (DSP) | Recipient counts and spending for DSP, separate from NDIS. |
| Age Pension | Recipient counts and spending; use the official name “Age Pension”. |

“Total” always means **these seven selected benefit groups**, not all Australian welfare spending. Carer Payment and Parenting Payment remain outside the confirmed initial scope pending the user's category decision.

### Other major categories identified for the user's decision

Services Australia's 2024–25 annual report (printed pages 56–58) reports Parenting Payment ($8.1 billion), Carer Payment ($8.1 billion), Carer Allowance ($3.0 billion), Child Care Subsidy ($15.2 billion) and Parental Leave Pay ($3.2 billion). Recommend including these for broader coverage of major household payments. They are proposed additions, not yet approved categories. The scope is selected household benefits plus NDIS; a complete welfare-services account would require a separate decision about aged-care services and other programmes, including veterans' support. Austudy and ABSTUDY are further student-payment categories to consider, separate from Youth Allowance.

Source: https://www.servicesaustralia.gov.au/sites/default/files/2025-10/annual-report-2024-25.pdf

## Experience

Use a single responsive page with a short explanation, area search, an area summary and an export preview. Area search accepts council/electorate names and four-digit postcodes. If a postcode intersects several areas, present labelled choices rather than assigning it to one area silently. Area names include state/territory and geography type to distinguish duplicate names. Selecting an area updates a shareable URL with its stable identifier and data release.

Mobile is explicitly search-first: show the postcode/electorate/council search, labelled area choices, summary and downloads, with no map. Use the same search flow on desktop for this release. Any future desktop map must retain the complete search-based mobile flow. Stack controls and summary/preview sections on small screens; ensure touch targets, legible count/money labels and no horizontal page scrolling. Check at 320, 375 and 430 CSS-pixel viewport widths, including an open software keyboard and long area names.

Offer two export styles:

- **Receipt:** a compact till-receipt layout showing estimated annual spending per resident for each of the seven groups, the corresponding local recipient/participant counts, and a selected-benefits spending total.
- **Invoice:** a clean document layout showing local recipient/participant counts and estimated annual total spending for the same seven groups and the same area.

Each export includes the area name/type, AUD units, reporting period, estimate labels, source/method note and a QR code linking to the matching area summary. Downloads are PNG and PDF; printing is also supported. The page shows recipient/participant context and the detailed components without attempting to sum them into a unique-person total. Export labels describe an area spending summary; they do not suggest an individual resident owes money.

Counts are a primary part of the page and both export styles, not hidden only in a detail panel. Label the unit and count reference date from the source. Use “people” for individual recipient counts, “participants” for NDIS, and the published family/income-unit label where the source counts those instead. Family Tax Benefit A and B counts appear separately because their populations overlap; do not add them into a family or people total. Youth Allowance counts retain both category labels unless the source supplies a compatible combined total. Never sum recipient counts across benefit groups or imply that these are unique individuals. A suppressed count remains a labelled bound or unavailable value in every output.

Use the same validated data and arithmetic for the page, preview and both downloadable formats. Calculate totals from unrounded amounts, then round for display; include a rounding note. For a missing line item, show “Unavailable” and label any remaining sum as a subtotal. Never treat missing or suppressed values as zero.

## Visual direction

The visitor is reading on a phone in daylight or a laptop at home and needs to understand the figures quickly. Use a light, high-contrast interface with readable type and a restrained accent. The receipt uses a monospace print treatment; the invoice uses conventional document typography. Australian identity comes from wording and data, with independent site branding. Do not reproduce the UK organisation's logos, campaign slogans or politician branding.

Make the search and download controls accessible by keyboard and touch. Announce selected-area and download status changes. Provide text equivalents of export content. The source/method note remains legible in downloaded images and PDFs.

## Data evidence and calculation contract

Verified on 7 October 2026:

- Services Australia says Newstart stopped on 20 March 2020 and existing recipients moved to JobSeeker: https://www.servicesaustralia.gov.au/newstart-allowance
- DSS publishes quarterly demographic tables including electorate, postcode and LGA breakdowns: https://data.gov.au/data/dataset/dss-payment-demographic-data
- The current DSS LGA resource covers December 2024–June 2026 with 2024 LGA codes. Its fields include JobSeeker, both Youth Allowance categories, both FTB parts and Commonwealth Rent Assistance: https://data.gov.au/data/dataset/dss-payments-by-local-government-area
- NDIA publishes participant counts for CEDs and LGAs through June 2026: https://dataresearch.ndis.gov.au/datasets/participant-datasets
- NDIA's June 2026 payments file has payment amount and participant-count fields by state/service district and other dimensions, rather than CED or LGA fields: https://dataresearch.ndis.gov.au/datasets/payments-datasets
- The NDIS LGA participant file names its geography field LGANm2020, whereas DSS uses LGA_CODE_2024. These are not interchangeable without a verified concordance.
- ABS regional population provides estimated resident population with explicit reference dates and geography vintages: https://www.abs.gov.au/statistics/people/population/regional-population/latest-release

First implementation task: audit the source definitions, geography coverage and spending inputs before enabling money figures. Recipient counts alone are not actual expenditure.

Prefer a reported local payment amount where the source publishes one for the correct area and period. Otherwise estimate local spending from a separately reported, compatible program expenditure total and the area's share of the matching recipient population. Document the weighting period and population definition. Use service-district weighting for NDIS only if source definitions and geography concordances support it; otherwise use a labelled national-average allocation. Such allocations are estimates of distribution, not measured local expenditure or benefit entitlements.

Choose the newest financial year with complete, compatible spending inputs for all seven groups. Display any more recent recipient snapshot with its own date. Do not mix financial years inside a total. Youth Allowance and FTB component expenditures must be distinct. Verify whether base-program expenditure includes Rent Assistance before adding its line; remove overlap using documented inputs, or leave the combined total unavailable.

Use a published ABS population denominator compatible with the selected area boundaries and record its reference date. When exact matching population is unavailable, show the area total but disable the per-resident receipt with an explanation. Never use electorate enrolments as resident population.

Preserve source suppression and rounding. DSS metadata says cells have been rounded to the nearest five since December 2022. NDIS sample participant records contain suppressed values such as <11; retain their status instead of inventing exact counts. Respect dataset licensing and attribution.

## Architecture and delivery approach

Recommend a static application with checked-in, validated data snapshots and downloads generated in the browser. This avoids dependence on government source availability while a visitor is using the site and needs no visitor accounts or database. Use Sites hosting after the implementation passes verification; new Sites remain owner-private until the user requests broader access.

Separate the implementation into:

1. Source acquisition and normalisation scripts, with source URLs, release dates, geography vintage and unit definitions.
2. A validated area index and benefit data snapshot, with explicit reported/estimated/unavailable/suppressed statuses.
3. A small calculation layer for spending allocations, totals, per-resident values and display formatting.
4. Search, area selection, summary and receipt/invoice preview components.
5. A shared export model and browser PNG/PDF generation.

Alternatives considered: live government API queries add latency and fragile cross-origin/source dependencies; a full dashboard with maps adds scope before proving the requested export feature. Neither is needed for the first release.

No automatic refresh schedule is created in this release. Source scripts permit deliberate repeatable updates. Receipt URLs pin a release so a saved graphic can be traced to the data used.

## Errors and validation

Handle invalid postcodes, ambiguous searches, unknown areas, unincorporated areas, missing population, unavailable benefit data and export failures with actionable messages. Keep the selected area and preview intact after download failure.

Acceptance checks:

- Name/postcode lookup distinguishes area types and states; ambiguous postcodes return choices.
- All seven requested groups appear with the correct components, including DSP, Age Pension and NDIS as separate groups.
- Each benefit group shows counts alongside spending on the page, receipt, invoice, PNG and PDF, with correct source units and snapshot dates. Overlapping components and benefit groups never produce an invented unique-person total.
- Known source examples reconcile to imported counts and spending inputs; aggregate/subtotal rows are not counted twice.
- Suppressed values, mismatched boundaries, missing inputs and Rent Assistance overlap cannot silently produce a complete total.
- Page, receipt, invoice, PNG and PDF agree on area, period, arithmetic and provenance.
- Per-resident amounts use the documented denominator; totals derive from unrounded values.
- PNG and PDF download and open correctly, QR codes resolve to the pinned area page, and sources remain readable.
- Keyboard controls, mobile layouts, loading/error states and desktop previews are checked in the browser.
- At 320, 375 and 430 CSS-pixel widths, postcode/electorate/council search works without a map, counts and spending remain legible, and both export styles download without horizontal page scrolling.

The launch is complete when a visitor can find their area and download both formats with all requested benefit groups supported by verified data or clearly explained source limitations. A visual prototype with fabricated figures does not satisfy this design.
