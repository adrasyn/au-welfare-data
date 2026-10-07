# Receipt data audit

Release `2024-25-v1`, prepared 7 October 2026.

## Confirmed scope

JobSeeker, both Youth Allowance categories, NDIS, FTB A/B, Commonwealth Rent Assistance, DSP, Age Pension, Parenting Payment Single/Partnered and Carer Payment. Child Care Subsidy, Parental Leave Pay, Carer Allowance and Carer Supplement are excluded by the user's scope decision.

## Period and population

Money: FY2024–25 actual administered expenditure from DSS Table A-6 and NDIA participant support accrual expenses. Counts: published June2025 snapshots. Population: ABS June2024 resident estimates on exactly matching CED/LGA2024 boundaries, released March2025. Dates remain separate in the interface and every export.

The estimate allocates the national annual expenditure by the area's share of the same programme's national June2025 recipient population. This is a distribution model, not a measurement of local payments. It does not assume maximum entitlements or infer actual individual benefits. National denominators retain unknown/overseas recipients; local shares are not renormalised over only geocoded areas. FTB instalment families are a proxy for allocating expenditure that also covers lump sums; that limitation is disclosed.

## Geography

697 areas: 150 federal electorates and 547 ABS council/statistical local areas. Postcodes use common Mesh Block2021 identities in ABS POA2021/CED2024/LGA2024 allocation workbooks, yielding 2,641 Postal Area lookups. Delivery-only/PO Box codes can be absent; ambiguous postcodes return choices.

NDIS council participant counts are resolved to the official source LGA2020 registry and converted through the four ABS annual correspondence tables to LGA2024. Population ratios are multiplied through each step without arbitrary name matching or normalisation. Converted non-identity counts are marked estimated. A suppressed contribution prevents a target from being presented as an exact complete count. Unknown-source residual records are not assigned to arbitrary councils. NDIS electorate counts join the published CED2024 identity directly.

## Units and overlap

- Individual income-support counts: people, including the DSS expanded suspended/zero-rate populations.
- NDIS: active participants. National denominator739,414 from NDIA's June2025 report.
- FTB: instalment families, separated into A/B; not combined because they overlap. Lump-sum-only families are absent from counts.
- CRA: recipient income units. Several units can share one dwelling.
- There is no aggregate unique-person count across programmes.
- DSS rounds counts to the nearest five; NDIS suppression remains unavailable or a published bound.
- CRA is embedded within primary payment expenditure. Its cross-program estimate is shown for context but is not added to the programme subtotal. Some CRA-paying programmes are outside this selection; the full CRA line is not labelled “already included above”.

## Provenance and reproducibility

`source-manifest.json` records downloaded source URLs, file sizes and SHA256 hashes. `preparation-audit.json` records coverage and unknown residuals. The research notes identify exact audited national expenditure tables and the decisive CRA overlap footnote. `npm run data:acquire`, bundled-Python `scripts/extract-workbooks.py`, and `npm run data:prepare` rebuild the snapshot from cached official inputs. Replace cached inputs deliberately when updating; never overwrite a pinned release already used by receipts.

## Verification

Ingestion tests verify suppression, zero/missing values, duplicate IDs and ABS ratio allocation. Model/export tests verify count-unit preservation, component overlap, CRA exclusion, unrounded arithmetic, period mismatch, missing population, pinned QR links and format-specific money presentation. Browser QA checks actual selected-area figures, document images, mobile overflow and downloaded-file content through a temporary localhost capture, removed before publication.
