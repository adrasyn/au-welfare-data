"""Extract GEN counts and allocate them through verified official ABS correspondences.

Run with the bundled Python/openpyxl runtime after acquiring the files recorded in
.cache/sources/aged-care-source-manifest.json. Legacy XLS correspondence extracts
contain both Table 3 and Table 4 (below-minimum transfers), using PERCENTAGE / 100.
No suppressed/missing source row is converted into a zero observation.
"""
import csv
import json
from collections import defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'sources'


def correspondence(filename, from_key, to_key):
    result = defaultdict(list)
    with (CACHE / filename).open(encoding='utf-8-sig') as file:
        for row in csv.DictReader(file):
            source = row[from_key]
            if not source:
                continue
            ratio = row.get('RATIO_FROM_TO', '')
            if not ratio:
                continue
            result[source].append((row[to_key] or None, float(ratio)))
    return result


def chain(source, maps):
    paths = {source: 1.0}
    for mapping in maps:
        next_paths = defaultdict(float)
        for old, share in paths.items():
            for target, ratio in mapping.get(old, [(None, 1.0)]):
                next_paths[target] += share * ratio
        paths = next_paths
    return paths


def workbook_counts(filename, sheet, value_column):
    workbook = openpyxl.load_workbook(CACHE / filename, read_only=True, data_only=True)
    counts = {}
    for row in workbook[sheet].iter_rows(min_row=4, values_only=True):
        if row[0] is None:
            continue
        code = str(int(row[0])) if isinstance(row[0], (int, float)) else str(row[0])
        if not code.isdigit():
            continue
        value = row[value_column]
        assert code not in counts, f'Duplicate source code {code}'
        counts[code] = value if isinstance(value, (int, float)) else None
    workbook.close()
    return counts


def allocate(counts, maps, registry):
    values = defaultdict(float)
    unavailable = set()
    unallocated = 0.0
    # A source not present in the GEN table is not evidence of zero recipients.
    source_codes = set(maps[0]) | set(counts)
    for source in source_codes:
        value = counts.get(source)
        for target, share in chain(source, maps).items():
            if share <= 0:
                continue
            if target not in registry:
                if value is not None:
                    unallocated += value * share
            elif value is None:
                unavailable.add(target)
            else:
                values[target] += value * share
    result = {}
    for code in registry:
        if code in unavailable or code not in values:
            result[code] = {'value': None, 'status': 'unavailable', 'unit': 'people'}
            if code in values:
                result[code]['knownSubtotal'] = values[code]
        else:
            result[code] = {'value': values[code], 'status': 'estimated', 'unit': 'people'}
    source_total = sum(value for value in counts.values() if value is not None)
    allocated_total = sum(values.values())
    residual = source_total - allocated_total - unallocated
    # Official correspondence ratios have limited decimal precision; preserve it.
    assert abs(residual) < 1, (source_total, allocated_total, unallocated, residual)
    return result, {
        'sourceRecords': len(counts), 'missingSourceRecords': len(source_codes - set(counts)),
        'mappedSourceCount': source_total, 'allocatedNumericCount': allocated_total,
        'outsideRegistryOrUnallocatedCount': unallocated, 'ratioRoundingResidual': residual,
        'estimatedAreas': sum(row['status'] == 'estimated' for row in result.values()),
        'unavailableAreas': sum(row['status'] == 'unavailable' for row in result.values()),
    }


def main():
    population = json.loads((CACHE / 'abs-extracted.json').read_text())['population']
    manifest = json.loads((CACHE / 'aged-care-source-manifest.json').read_text())
    sa3_ced = correspondence('CG_SA3_2016_CED_2021.csv', 'SA3_CODE_2016', 'CED_CODE_2021')
    ced24 = correspondence('CG_CED_2021_CED_2024.csv', 'CED_CODE_2021', 'CED_CODE_2024')
    sa3_lga17 = correspondence('CG_SA3_2016_LGA_2017.csv', 'FROM_CODE', 'TO_CODE')
    lga17_18 = correspondence('CG_LGA_2017_LGA_2018.csv', 'FROM_CODE', 'TO_CODE')
    lga18_25 = correspondence('CG_LGA_2018_LGA_2025.csv', 'LGA_CODE_2018', 'LGA_CODE_2025')
    lga24_25 = correspondence('CG_LGA_2024_LGA_2025.csv', 'LGA_CODE_2024', 'LGA_CODE_2025')
    # Every 2025 polygon has exactly one 2024 parent. The only changed geometry
    # splits old East Arnhem into two children; aggregate those children exactly.
    # This is containment aggregation, never inversion of population ratios.
    parents = defaultdict(set)
    for old, targets in lga24_25.items():
        assert abs(sum(weight for _, weight in targets) - 1) < 0.000001
        for new, _ in targets:
            parents[new].add(old)
    assert all(len(old) == 1 for old in parents.values())
    lga25_24 = {new: [(next(iter(old)), 1.0)] for new, old in parents.items()}
    lga16_21 = correspondence('CG_LGA_2016_LGA_2021.csv', 'LGA_CODE_2016', 'LGA_CODE_2021')
    lga21_22 = correspondence('CG_LGA_2021_LGA_2022.csv', 'LGA_CODE_2021', 'LGA_CODE_2022')
    lga22_23 = correspondence('CG_2022_LGA_2023_LGA.csv', 'LGA_CODE_2022', 'LGA_CODE_2023')
    lga23_24 = correspondence('CG_LGA_2023_LGA_2024.csv', 'LGA_CODE_2023', 'LGA_CODE_2024')
    configs = [
        ('aged-care-residential', 'gen-residential-2025.xlsx', '4', 4, 'snapshot', 203624,
         'service location', 'SA3 2016', [sa3_lga17, lga17_18, lga18_25, lga25_24], True),
        ('aged-care-home', 'gen-home-care-2025.xlsx', '2', 6, 'snapshot', 291435,
         'recipient location', 'LGA 2016 / SA3 2016', [lga16_21, lga21_22, lga22_23, lga23_24], False),
        ('aged-care-support', 'gen-home-support-2025.xlsx', '1', 2, 'annual', 834278,
         'recipient location', 'LGA 2017 / SA3 2016', [lga17_18, lga18_25, lga25_24], False),
    ]
    programmes = []
    audits = {}
    for identifier, filename, table, column, coverage, national, basis, vintage, lga_maps, use_sa3 in configs:
        sa3 = workbook_counts(filename, f'Table {table}.2 (SA3)', column)
        lga = sa3 if use_sa3 else workbook_counts(filename, f'Table {table}.1 (LGA)', column)
        assert sum(value for value in sa3.values() if value is not None) == national
        assert sum(value for value in lga.values() if value is not None) == national
        ced_counts, ced_audit = allocate(sa3, [sa3_ced, ced24], population['ced'])
        lga_counts, lga_audit = allocate(lga, lga_maps, population['lga'])
        programmes.append({
            'id': identifier, 'nationalCount': national, 'countCoverage': coverage,
            'countDate': '2025-06-30' if coverage == 'snapshot' else '2024-25',
            'sourceVintage': vintage, 'locationBasis': basis,
            'counts': {'ced': ced_counts, 'lga': lga_counts},
            'nationalCountBasis': 'Sum of published geographically mapped GEN records; excludes unmappable addresses.',
            'missingAddressResidual': None,
            'coverageNote': 'GEN excludes missing, incomplete or unmappable addresses; an exact like-for-like national residual has not been verified.',
        })
        audits[identifier] = {'ced': ced_audit, 'lga': lga_audit}
    sources = [{'id': row['id'], 'title': row.get('archiveMember', row['filename']), 'url': row['url']} for row in manifest['entries']]
    output = {'programmes': programmes, 'sources': sources, 'audit': audits}
    (CACHE / 'agedcare-extracted.json').write_text(json.dumps(output, indent=2))
    print(json.dumps(audits, indent=2))


if __name__ == '__main__':
    main()
