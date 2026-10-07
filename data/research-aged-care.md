# Aged care counts and geography audit

Verified 7 October 2026 against the actual official GEN XLSX tables and ABS correspondence archives. This audit covers counts and geography; the spending source and any NDIS accounting overlap must be reconciled separately before adding spending to a combined total.

## Usable count sources

GEN's [People using aged care by region](https://www.gen-agedcaredata.gov.au/resources/access-data/2026/february/gen-data-people-using-aged-care-by-region), released 12 February 2026, provides LGA and SA3 tables, but no CED table.

| Programme | Reporting period | Geographic basis | Table and numeric column | Sum of mapped records |
| --- | --- | --- | --- | --- |
| Home support (CHSP) | Distinct recipients throughout 2024–25 | Recipient's last recorded address in financial year; LGA2017 or SA3 2016 | Table1.1 LGA or1.2 SA3, C | 834,278 |
| Home care packages (HCP) | 30 June2025 snapshot | Recipient address; LGA2016 or SA3 2016 | Table2.1 LGA or2.2 SA3, G (sum of levels1–4) | 291,435 |
| Residential care | 30 June2025 snapshot, permanent plus respite | Service physical address; SA3 2016 | Table4.2 SA3, E (permanent+respite) | 203,624 |

Residential mapped counts are 196,313 permanent and7,311 respite. Home care package mapped counts are12,790 level1,106,360 level2,106,327 level3 and65,958 level4. The three programmes are separate measures with overlap and different reporting periods; do not add counts as unique people.

All numeric codes begin at row4, following the row3 headers. XLSX sheets may include empty trailing rows; restrict records to numeric geography codes. All inspected programme count cells are numeric, including small counts; no `n.p.` suppressed count cells were present. Nevertheless the published symbol definition must remain supported.

The Notes sheets explicitly exclude missing, incomplete or unmappable addresses. GEN's national topic page gives approximate wider totals of839,000 CHSP,293,000 HCP and204,000 residential; these rounded numbers must not be used to manufacture an exact residual. All nationalCount fields in the intermediate artifact represent the sum of mapped GEN records, not an independently verified count of all recipients. A missing GEN geographic row remains unavailable rather than inferred zero. The script preserves known numeric subtotals for destinations affected by a missing source row.

Direct download URLs, verified with curl (urllib's default user agent returned403):

- [Home support recipient locations](https://www.gen-agedcaredata.gov.au/getmedia/53b57e6e-6be8-401b-b1e8-9baf430d18d4/GEN-data-People-using-aged-care-by-region-2024-25-1-home-support-(recipient-location))
- [Home care recipient locations](https://www.gen-agedcaredata.gov.au/getmedia/6e2f01d1-f230-4e0d-b869-8c746aa3e372/GEN-data-People-using-aged-care-by-region-30-June-2025-2-home-care-(recipient-location))
- [Residential service locations](https://www.gen-agedcaredata.gov.au/getmedia/77b4008b-88bb-424b-b831-0d729ba3984b/GEN-data-People-using-aged-care-by-region-30-June-2025-4-residential-care-(service-location))

Home care service-location tables are also available, but must not be substituted for recipient location: provider addresses can be distant from the people receiving home care. The residential service LGA headers omit a vintage, whereas the SA3 title explicitly specifies2016. The extraction therefore uses the SA3 table for residential counts, avoiding an undocumented assumption about the LGA vintage.

## Official correspondence paths

All count conversions use official ABS correspondence ratios, not postcode centroids or invented crosswalks.

- All programmes, CED: `SA3 2016 → CED2021 → CED2024`.
- Home care, LGA: `LGA2016 → LGA2021 → LGA2022 → LGA2023 → LGA2024`.
- Home support, LGA: `LGA2017 → LGA2018 → LGA2025 → LGA2024`.
- Residential, LGA: `SA3 2016 → LGA2017 → LGA2018 → LGA2025 → LGA2024`.

[ABS ASGS2021 Edition3 correspondence archive](https://data.gov.au/data/dataset/2c79581f-600e-4560-80a8-98adb1922dfc/resource/33d822ba-138e-47ae-a15f-460279c3acc3/download/asgs2021correspondences.zip) contains the actual cross-structure file `CG_SA3_2016_CED_2021.csv`, as well as `CG_CED_2021_CED_2024.csv`, `CG_LGA_2016_LGA_2021.csv`, `CG_LGA_2018_LGA_2025.csv` and `CG_LGA_2024_LGA_2025.csv`. CSV headers include source and target codes, `RATIO_FROM_TO`, quality indicators and `BMOS_NULL_FLAG`.

[ABS ASGS2016 correspondence archive](https://data.gov.au/data/dataset/23fe168c-09a7-42d2-a2f9-fd08fbd0a4ce/resource/951e18c7-f187-4c86-a73f-fcabcd19af16/download/asgs2016correspondences.zip) contains `CG_SA3_2016_LGA_2017.xls` and `CG_LGA_2017_LGA_2018.xls`. Each has correspondence Table3 and below-minimum Table4, with disjoint source/target pairs. Include both tables. They explicitly identify the weights as2016 Mesh Block population weighted. Normalized cached CSVs use `PERCENTAGE /100`, because a positive very small transfer can be rounded to zero in the lower precision `RATIO` column. This preserves official transfer weights rather than renormalizing them.

The2025→2024 step is exact containment aggregation, not an inverted population correspondence. The verified official2024→2025 file has exactly one2024 parent for every2025 target. Its only changed codes are old East Arnhem71300 dividing into71500 East Arnhem and71700 Groote Archipelago. Sum those two children back to71300 with weight1 each. Every other2025 area has a one-to-one parent. The script asserts the unique parent relationship and complete forward weight sums; do not reuse this method if a future boundary change introduces a child spanning multiple parents.

The remaining LGA2021→2024 correspondence CSVs are the previously acquired official files described in `research-geography.md`. Preserve missing-target transfers as unallocated, preserve below-minimum positive ratios and retain fractional estimates internally. Population ratios assume care users have the same distribution as the general resident population; they do not observe where individual recipients live. Residential allocation is particularly approximate because service locations do not follow general population distribution. User-facing notes should describe the resulting counts as geographic estimates, with residential service-location qualification.

## Prepared artifact and checks

`scripts/extract-aged-care.py` writes `.cache/sources/agedcare-extracted.json`. Programme fields include count period, source vintage, location basis, mapped nationalCount, CED/LGA count objects, known subtotals and coverage notes. `.cache/sources/aged-care-source-manifest.json` records download URLs, source archive members, bytes and SHA256 checksums. Official raw files and normalized legacy correspondence CSVs are cached beside it.

The Office skill path supplied in AGENTS.md is not present on this Mac. Read-only extraction uses the bundled Python runtime and openpyxl; legacy XLS sources were inspected once using xlrd installed into a temporary directory. The script itself needs only openpyxl and the prepared CSVs, not xlrd.

Run:

```sh
/Users/James/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/extract-aged-care.py
```

The script asserts exact LGA/SA3 agreement with the mapped programme total before conversion, no duplicate source codes, each2025 LGA's unique2024 parent, and count conservation within one person across each chain. It records numerical allocation, genuinely unallocated transfer mass, tiny official ratio precision residuals, missing source rows and unavailable destinations. The precision residual is below0.002 people in every conversion. It does not silently scale counts to close an accounting difference.

Initial availability with conservative missing-row treatment:

| Programme | CED estimated / unavailable | LGA estimated / unavailable |
| --- | --- | --- |
| Residential | 133 /17 | 517 /30 |
| Home care | 141 /9 | 524 /23 |
| Home support | 141 /9 | 539 /8 |

Unknown addresses cannot be allocated to named areas from these tables. Broader national counts from a separate snapshot publication may have methodological differences, as GEN's Notes sheet explicitly warns. Record a like-for-like residual only after verifying its source and denominator; do not describe a rounded subtraction or a cross-publication difference as precisely the count of missing addresses.

## Additional useful source

The [aged care service list,30June2025](https://www.gen-agedcaredata.gov.au/resources/access-data/2025/october/aged-care-service-list-30-june-2025) includes actual2024–25 Australian Government funding at service level, service addresses and2023 LGA codes. [Australia XLSX](https://www.gen-agedcaredata.gov.au/getmedia/2599a590-3c5f-4227-aac3-f0a3a8aa84e4/Service-List-2025-Australia_300126). It is service-location funding, so cannot establish home care spending at recipients' residential locations. Provider/service funding, annual national expenditure and resident-attributed estimates are different metrics and need separate labels.

## Spending and combined totals

The [2024–25 Report on the Operation of the Aged Care Act](https://www.gen-agedcaredata.gov.au/getmedia/cd6a26e3-f236-469b-859b-0e164fa46702/25256-Health-and-Aged-Care-ROACA24-25-WEB) supplies the matched Commonwealth amounts: residential care **$23,965.6m** (tables 15 and 26, including DVA permanent/respite care); Home Care Packages **$8,659.9m** (tables 10 and 27, net expensed payments after income-testing, refunds and unspent funds); CHSP direct services **$3,270.0m** (table 6, excluding separately described $34.5m initiatives). These are different from the broader RoGS recurrent total and exclude administration, flexible/other care programmes and private fees.

`extend-aged-care.mjs` uses each area's mapped GEN count / the sum of mapped programme counts × matched national programme spending. This is an allocation proxy: it assumes unknown-address clients' spending distribution resembles mapped clients. It does not claim an observed local spend or a separately quantified unknown-address expenditure residual. Missing source rows retain their known partial numeric subtotal with an incomplete label. Those incomplete observations do not acquire a total, per-person or recipient-rate rank.

[NDIA guidance](https://ourguidelines.ndis.gov.au/supports-you-can-access-menu/home-and-living-supports/younger-people-residential-aged-care/what-residential-aged-care-fees-and-charges-do-we-fund) explicitly covers reimbursements of residential aged-care subsidies and supplements. The Health annual report reports aged-care recoveries, cross-billings and budget-neutrality adjustments together; no matching exact NDIS offset was verified. Do not subtract the combined recovery figure or a year-end payable from annual expenditure. Residential care is non-additive in the All subtotal containing NDIS; retirement includes it because NDIS is outside that programme group. Rent Assistance remains contextual and non-additive in every group. Home-care and CHSP direct services are additive. Working-age and retirement group totals consequently are not a decomposition of the All subtotal.

Sydney's incomplete residential and CHSP estimates arise from missing spatial SA3 10803 (Lord Howe Island) records. Its home-care source row exists. Official ABS correspondences transfer a positive Lord Howe share through CED2021 Sydney to CED2024 Sydney. The missing record cannot be treated as zero; Sydney retains known partial amounts and remains unranked for complete retirement spending.

Frozen v2 preserves v1 unchanged. Ranked complete coverage by group is All **139 CED / 497 LGA**, Working-age **150 / 508**, Retirement **133 / 493**. Percentage denominators remain all June2024 residents, not an age-specific population. Programme groups are not actual recipient age bands.

## v3: include gross residential spending

The user requested inclusion if the reimbursement overlap is small, with disclosure in the calculation methodology. This supersedes the conservative v2 exclusion policy for new links; v1 and v2 remain frozen.

The [NDIA 2024–25 actuarial report, printed page 220](https://www.ndis.gov.au/media/8183/download?attachment=) says off-system payments, including residential care and taxi subsidies, account for less than 1% of Scheme expenditure. Using [NDIA participant-plan expenses of $46,352.178m](https://ndis.gov.au/media/8108/download?attachment=), that suggests a scale below approximately $463.5m, or 1.93% of the $23,965.6m residential total (1.29% of the three included aged-care programmes). This is an indicative comparison, not an audited exact overlap or a local-area ceiling: the report does not provide a matched annual residential-care-only offset. The Health report's $507.063m bundled recoveries and NDIA's $725.7m year-end payable must not be substituted for that offset.

`scripts/include-residential-care.mjs` clones v2 into v3, preserving every count, expenditure estimate and population. It marks residential care `overlapPolicy: include-gross`, making it additive in All even with NDIS present. Rent Assistance remains non-additive. The methodology, standalone exports and social descriptions disclose that no reimbursement overlap is deducted. No invented national or local deduction is applied.

All ranks now require residential-care coverage: **133 CED / 472 LGA**. Working-age (**150 / 508**) and retirement (**133 / 493**) coverage stays the same. Areas with incomplete care data retain known subtotals without receiving a complete-total or per-person rank. Armidale All increases from $261,765,917.8114 to $288,700,265.7177, or $9,738 per resident rounded, while its old v2 share retains $8,830.

## Proposed ranking correction, investigated 7 October 2026

This section records the researched proposal that preceded the local v4 implementation documented below. At investigation time, v3 and the live site were unchanged.

The current extraction conflates an absent region in a positive-record table with an explicitly unavailable observation. Each of the three inspected regional tables has only positive numeric totals: residential has 323 SA3 rows, home care 335 and CHSP 336. No total cell is zero, suppressed or otherwise non-numeric. The Notes do not explicitly say that every absent region has zero recipients; they exclude unmappable addresses. Therefore absence alone is not sufficient evidence of a real-world zero, especially for recipient-location programmes.

An independent residential check used the [30 June 2025 Australia service register](https://www.gen-agedcaredata.gov.au/getmedia/2599a590-3c5f-4227-aac3-f0a3a8aa84e4/Service-List-2025-Australia_300126), downloaded from the [official service-list publication](https://www.gen-agedcaredata.gov.au/resources/access-data/2025/october/aged-care-service-list-30-june-2025). Its 2,590 rows with Care Type `Residential` occupy exactly the same 323 SA3 2016 regions as the positive residential recipient table. Every omitted spatial SA3 has no registered mainstream residential facility. Some have Multi-Purpose or Indigenous flexible-care services; those are different programmes and must not be interpreted as missing mainstream residential counts. This supports a programme-specific, date-specific structural-zero inference for the residential snapshot. It does not validate zeros for home-care or CHSP residents, and says nothing about facility funding earlier in the financial year.

The existing expenditure model allocates matched national programme budgets in proportion to published geographically mapped client counts. Its denominator already excludes unlocated clients and its notes already disclose the assumption that their spending distribution resembles mapped clients. Across all 150 CEDs, the sum of numeric allocations, including existing known subtotals, is:

| Programme | Matched national budget | Existing numeric allocation | Allocated share |
| --- | ---: | ---: | ---: |
| Residential care | $23,965,600,000 | $23,965,593,757.41 | 99.999974% |
| Home-care packages | $8,659,900,000 | $8,659,898,515.67 | 99.999983% |
| Home support | $3,270,000,000 | $3,269,999,216.06 | 99.999976% |

The residuals come from outside-registry transfers and official correspondence precision. This checks allocation arithmetic, not completeness of observed client coverage. Crucially, the current 17 exclusions do not represent 17 unallocated aged-care budgets; the published-data spending model already produces an allocation for them.

Recommended correction: distinguish completeness of observed recipient counts from availability of a modelled programme-budget allocation. Use the existing published-mapped-client allocation as the explicit spending estimate, including when the observed count retains an incomplete label. Do not manufacture additional recipients or treat an absent source row as an observed zero. Keep recipient-rate ranks withheld where counts remain incomplete. Only allow this expenditure estimate after checking the entire published source table is numeric, its totals reconcile across independently tabulated regional structures, all budget/period/geography controls match, and the destination has a valid allocation. Explicit suppression, incompatible metadata, and unavailable primary payment amounts must continue to withhold affected ranks.

An in-memory experiment applying this narrowly to aged-care spending with an existing finite known subtotal restores spending and per-person ranks for all 150 CEDs. Existing numerical area spending and per-person values do not change. All-welfare LGA spending coverage becomes 491/547, with other missing/suppressed programmes still excluding areas. Residential recipient-rate coverage remains 133/150 CEDs until the separately evidenced structural-zero policy is implemented. This experiment is not a production change.

Suggested public methodology: “Aged-care spending is estimated by allocating national programme expenditure using published, geographically mapped client shares and ABS correspondence tables. Areas can receive a spending estimate even when recipient-count coverage is incomplete. Unlocated clients are assumed to have the same spending distribution as mapped clients. Rankings compare these allocation estimates, rather than audited local expenditure.”

If implemented, publish a new frozen release rather than changing v1–v3 shared links, preserve count-coverage notes in area details and exports, and keep the independent national-budget reconciliation in the reproducible release audit. Exact rank positions describe point estimates; they should not imply statistical certainty about the true order of close areas.

## V4 implementation

The user approved the proposal. `scripts/audit-aged-care-ranking.py` checks all six regional programme total columns and writes the checked-in source control artifact with SHA256 hashes. `scripts/allocate-mapped-aged-care.mjs` builds `2024-25-v4` from frozen v3 after validating source hashes against the manifest, numeric-only published controls, programme budgets/denominators, partial allocation arithmetic and national expenditure reconciliation for CED and LGA separately.

Every recipient-count object is unchanged. All dollar totals are unchanged: finite existing aged-care `knownSubtotal` allocations become explicit modelled point estimates, with their basis and incomplete count coverage recorded separately. No missing/suppressed primary-payment value is promoted. No absent recipient row is turned into zero. Incomplete recipient rates remain unranked, and no residential structural-zero inference is implemented.

V4 spending/per-person rank coverage is All **150 CED / 491 LGA**, Working-age **150 / 508**, Retirement **150 / 512**. Current v1–v3 files remain unchanged, preserving frozen shared-link data. Affected document footers and social descriptions disclose incomplete counts and modelled spending. Site methodology and ranking notes explain that ranks compare point estimates and national reconciliation does not establish complete real-world client coverage.
