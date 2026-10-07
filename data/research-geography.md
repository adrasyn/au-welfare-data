# Geography and population research

Verified against official ABS endpoints on 7 October 2026. Recommended consistent geography: POA2021 lookup, CED2024 and LGA2024 results, and **30 June 2024 estimated resident population (ERP)** as the denominator. Count dates can remain June 2025, provided the population date is visibly stated.

## Postcode → all intersecting CED2024 / LGA2024 areas

Use official ABS Mesh Block allocation tables, not postcode centroids and not polygon `intersects` (which also returns areas merely touching a boundary). These three workbooks assign the **same MB_CODE_2021** to the target geography. Join on that string and deduplicate `(postcode, CED)` / `(postcode, LGA)`. Every common Mesh Block constitutes positive-area overlap in the ABS approximation. Keep every resulting area rather than selecting a dominant one. No count allocation is performed in this lookup.

Download page: https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/allocation-files

Exact working downloads:

- https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/allocation-files/POA_2021_AUST.xlsx
- https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/allocation-files/CED_2024_AUST.xlsx
- https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/allocation-files/LGA_2024_AUST.xlsx

Each workbook has one sheet named as its filename without extension, headers at row 1, data at row 2. Headers verified by examining the actual XLSX XML:

```text
POA: MB_CODE_2021, POA_CODE_2021, POA_NAME_2021, AUS_CODE_2021,
     AUS_NAME_2021, AREA_ALBERS_SQKM, ASGS_LOCI_URI_2021
CED: MB_CODE_2021, CED_CODE_2024, CED_NAME_2024, STATE_CODE_2021,
     STATE_NAME_2021, AUS_CODE_2021, AUS_NAME_2021, AREA_ALBERS_SQKM,
     ASGS_LOCI_URI_2021
LGA: MB_CODE_2021, LGA_CODE_2024, LGA_NAME_2024, STATE_CODE_2021,
     STATE_NAME_2021, AUS_CODE_2021, AUS_NAME_2021, AREA_ALBERS_SQKM,
     ASGS_LOCI_URI_2021
```

POA workbook is 18,584,662 bytes; use build-time extraction, not browser loading. There are approximately 368,000 Mesh Blocks, not millions. Retain all codes as strings: e.g. postcode `0800`, CED `101`, LGA `10050`, MB `70034860000`.

Example extraction outline with openpyxl:

```python
from collections import defaultdict
from openpyxl import load_workbook

def allocation_rows(path):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    headers = next(it)
    for values in it:
        yield dict(zip(headers, values))
    wb.close()

poa_by_mb = {str(r['MB_CODE_2021']): str(r['POA_CODE_2021']).zfill(4)
             for r in allocation_rows('POA_2021_AUST.xlsx')}
lookup = defaultdict(lambda: {'ced': set(), 'lga': set()})
for geo in ('CED', 'LGA'):
    for r in allocation_rows(f'{geo}_2024_AUST.xlsx'):
        pc = poa_by_mb.get(str(r['MB_CODE_2021']))
        code = str(r[f'{geo}_CODE_2024'])
        # Restrict areas to the codes in the ERP tables below, which removes
        # nonspatial balancing codes while retaining genuine unincorporated LGAs.
        if pc and pc not in ('9494', '9797', 'ZZZZ'):
            lookup[pc][geo.lower()].add(code)
result = {pc: {geo: sorted(codes) for geo, codes in areas.items()}
          for pc, areas in sorted(lookup.items())}
```

Do filter CED/LGA memberships using the actual ERP code registries (see below), not solely the illustrative postcode exclusion. Return a deliberate “postcode not represented in ABS Postal Areas” state for absent postcodes. ABS POA2021 is a Mesh Block approximation, not a current Australia Post licensed postcode directory; PO Box-only and other delivery codes may be absent. Do not assert an address is definitely in an electorate from a postcode alone.

Source definition/caveats: https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/non-abs-structures/postal-areas

## Population on exactly matching 2024 boundaries

Use this working 271,275-byte official workbook:

https://www.abs.gov.au/statistics/people/population/regional-population/2023-24/32180DS0004_2001-24.xlsx

Landing page: https://www.abs.gov.au/statistics/people/population/regional-population/2023-24

Released 27 March 2025. Actual workbook footnotes explicitly confirm “Based on 2024 LGA boundaries” and “Based on 2024 CED boundaries”. Bullwinkel is included as code `502`, June2024 ERP `172486`.

| Sheet | XML path | Code | Name | June2024 ERP | Data starts |
| --- | --- | --- | --- | --- | --- |
| Table 1 | xl/worksheets/sheet2.xml | A | B | Z | row 8 |
| Table 4 | xl/worksheets/sheet5.xml | A | B | Z | row 8 |

Row 6 contains years; row 7 labels (`LGA code`, `LGA name (a)` or `CED code`, `CED name (a)`). Restrict data to numeric nonempty geography codes with numeric population; do not import total rows/footnotes. LGA table has 547 geographic rows (8–554), CED table 150 (8–157). These geographic registries exclude special nonspatial balancing codes while including genuine unincorporated areas and ACT.

```python
wb = load_workbook('32180DS0004_2001-24.xlsx', read_only=True, data_only=True)
population = {}
for geo, sheet in [('lga', 'Table 1'), ('ced', 'Table 4')]:
    entries = {}
    for row in wb[sheet].iter_rows(min_row=8, values_only=True):
        code, name, value = row[0], row[1], row[25]
        if code is not None and str(code).isdigit() and isinstance(value, (int, float)):
            entries[str(code)] = {'name': name, 'population': int(value),
                                  'populationDate': '2024-06-30',
                                  'boundaryYear': 2024}
    population[geo] = entries
wb.close()
```

This is **resident population**, including children and people not enrolled to vote; do not substitute AEC voter enrolments. Because latest releases revise historical ERP, describe this as the June2024 estimate from the 2023–24 release, not an unrevised timeless fact.

## June2025 ERP option and why it is more involved

Official latest workbook, released 31 March 2026:

https://www.abs.gov.au/statistics/people/population/regional-population/2024-25/32180DS0004_2001-25.xlsx

Table 1 LGA, Table 4 CED. Years row 5, labels row 6, data row 7 onward, June2025 column AA. The entire historical series is on **2025** boundaries. The June2024 column in this newer workbook is therefore NOT universally on 2024 boundaries.

Methodology and boundary changes: https://www.abs.gov.au/methodologies/regional-population-methodology/2024-25

- LGA2024 `71300 East Arnhem` split into LGA2025 `71500 East Arnhem` and `71700 Groote Archipelago`. Sum the two 2025 ERP values to recover old East Arnhem exactly; all other LGA boundaries/codes unchanged. Two LGA name changes (Cocos → Cocos (Keeling), Lower Eyre Peninsula → Lower Eyre) retain codes.
- CED2024 `701 Lingiari` / `702 Solomon` changed boundaries in 2025. The official 2024→2025 correspondence records 6.9606% of 2024 Lingiari donating to 2025 Solomon. **Do not invert forward population ratios or join NT by unchanged names/codes.** For an all-2024 site, the uniform June2024 denominator above is simpler and exact to geography.
- If a June2025 denominator is required, derive a valid 2025→2024 ABS correspondence or mark the two NT denominator conversions as estimates with method evidence. Other 148 CEDs have verified one-to-one correspondence.

## NDIS LGA2020 → DSS LGA2024

The user expressly requires official ABS correspondence tables for ASGS conversion. Use this **four-step chain**, multiplying/summing path weights. Do not simply normalize modern council names, strip `(C)/(S)/(A)/(M)`, or assume codes are unchanged.

Base URL: https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/correspondences/

Working filenames:

1. `CG_LGA_2020_LGA_2021.csv`
2. `CG_LGA_2021_LGA_2022.csv`
3. **`CG_2022_LGA_2023_LGA.csv`** (unusual ordering is correct)
4. `CG_LGA_2023_LGA_2024.csv`

Correspondence landing page and definitions: https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/correspondences

Headers: `LGA_CODE_<from>`, `LGA_NAME_<from>`, `LGA_CODE_<to>`, `LGA_NAME_<to>`, `RATIO_FROM_TO`, `INDIV_TO_REGION_QLTY_INDICATOR`, `OVERALL_QUALITY_INDICATOR`, `BMOS_NULL_FLAG`.

ABS weights represent the location of modelled resident population. Converted NDIS participant counts are geographic **estimates**, not observed exact NDIS counts for modern councils; do not imply that participants have the same distribution as general residents. Keep fractional allocated values internally and round only for display.

NDIA `LGANm2020` should be mapped to the official `LGA_NAME_2020` registry from the first correspondence, using a checked lookup to the corresponding code. If it only supplies names, exact source-name matching is legitimate identity resolution; this does not replace geographic correspondence. Preserve state disambiguation and require one code per source name. Log unmatched names; do not silently fuzzy-match.

Important changes verified in CSV:

- 2020→2021 includes Blacktown→Cumberland, Camden↔Campbelltown, Cumberland→Parramatta, Cook→Carpentaria/Lockhart River, George Town→West Tamar, Hobart→Glenorchy, Sorell→Clarence, plus small null coastline differences for Sutherland Shire and Circular Head.
- 2020 Unincorporated NT `79399` → 2021 Darwin Waterfront Precinct `71150` weight `0.1742561`, retained Unincorporated NT weight `0.8257439`.
- 2020 Unincorp. Other Territories `99399` → 2021 Christmas Island `51710` weight `0.7105957`, Cocos Islands `51860` weight `0.1538454`, retained Other Territories `99399` weight `0.1355589`.
- 2021 Unincorporated NT `79399` → 2022 Palmerston `72800` weight `0.0135498`, retained `0.9864502`.
- All real 2022→2023 and 2023→2024 ratios are 1. Name changes may still exist.

`BMOS_NULL_FLAG=1` means a very small real transfer; keep it. `2/4` means missing target; preserve as unallocated mass rather than renormalizing away. `3/5` means missing source; cannot donate a source count. Empty ratio means no usable allocation. Quality `Poor` should travel with results and be available in methodology; conversion can remain estimated rather than claimed exact.

**Suppression:** Do not allocate `<11`, `np`, or other suppressed/missing source values as if numeric; mark every destination receiving a nonzero share of a suppressed source as suppressed/unavailable. Do not treat suppression as zero or reverse-engineer hidden counts. A valid numeric zero can be allocated as zero. A destination can have a known numeric subtotal plus an unavailable component; the receipt must not present that subtotal as its complete count.

Outline for numeric conversion:

```python
# weights[source2020][target2024] = sum(product(step ratios) over paths)
# Start each source code with {source: 1.0}, then for each correspondence
# distribute each existing coefficient by RATIO_FROM_TO to next-year codes.
# Keep blank target paths separately as unallocated; do not renormalize.
# targetCounts[t] += sourceCount[s] * weights[s][t]
# If sourceCount[s] is suppressed, targetStatus[t] = 'suppressed'
# for every target having weights[s][t] > 0.
```

These are official primary-source correspondences, so there is no need to mark all NDIS councils incompatible merely because the source year is 2020. Where no valid source identity/correspondence exists, preserve unavailable rather than invent a conversion. NDIS CED2024 can join DSS CED2024 directly if the source documents genuinely specify that vintage.

## ArcGIS fallback / map display endpoints

Verified service metadata:

- https://geo.abs.gov.au/arcgis/rest/services/ASGS2024/CED/FeatureServer
- https://geo.abs.gov.au/arcgis/rest/services/ASGS2024/LGA/FeatureServer
- https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/POA/FeatureServer

Layer 0 is full geometry; layer 1 `_GEN` is generalized; layer 2 `_PT` is representative points. All report maxRecordCount 2000. Query with `f=json` or `f=geojson`, `where=1%3D1`, `outFields=*`, `returnGeometry=false` for registry only. POA has more than 2000 areas, so paginate or use objectId batches. CED/LGA registries fit in one response.

Layer 0 fields are lowercase (verified actual metadata):

```text
CED: ced_code_2024, ced_name_2024, state_code_2021, state_name_2021
LGA: lga_code_2024, lga_name_2024, state_code_2021, state_name_2021
POA: poa_code_2021, poa_name_2021
```

An endpoint for CED registry:

https://geo.abs.gov.au/arcgis/rest/services/ASGS2024/CED/FeatureServer/0/query?where=1%3D1&outFields=ced_code_2024%2Cced_name_2024%2Cstate_code_2021%2Cstate_name_2021&returnGeometry=false&f=json

The allocation XLSX approach is preferable for complete postcode membership; the ArcGIS routes are useful for mapping and validation. ABS statistical approximations do not exactly match legally gazetted council/electorate boundaries.
