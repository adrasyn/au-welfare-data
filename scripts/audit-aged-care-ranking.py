"""Audit the complete published GEN totals before enabling modelled allocations.

Read-only XLSX analysis; writes only the reproducible JSON control artifact.
No absent geographic row is classified as a real-world zero.
"""
import hashlib
import json
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
results = {}
for name, programme, prefix, column in [
    ('residential', 'aged-care-residential', '4', 4),
    ('home-care', 'aged-care-home', '2', 6),
    ('home-support', 'aged-care-support', '1', 2),
]:
    path = ROOT / '.cache' / 'sources' / f'gen-{name}-2025.xlsx'
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    tables = []
    for suffix in ['1 (LGA)', '2 (SA3)']:
        sheet = f'Table {prefix}.{suffix}'
        title = workbook[sheet]['A1'].value.replace('–', '-')
        assert ('2024-25' if name == 'home-support' else '30 June 2025') in title, 'Unexpected source period'
        rows = [row for row in workbook[sheet].iter_rows(min_row=4, values_only=True)
                if row[0] is not None and str(row[0]).replace('.0', '').isdigit()]
        assert rows, 'No regional records'
        assert all(isinstance(row[column], (int, float)) and row[column] >= 0
                   for row in rows), 'Source has suppressed or non-numeric totals'
        tables.append({'sheet': sheet, 'rows': len(rows),
                       'numericTotal': sum(row[column] for row in rows),
                       'nonNumericTotalCells': 0})
    assert tables[0]['numericTotal'] == tables[1]['numericTotal'], 'Regional controls disagree'
    results[programme] = {'sourceFile': path.name,
                          'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                          'tables': tables,
                          'nationalMappedCount': tables[0]['numericTotal']}
    workbook.close()
output = {'verifiedAt': '2026-10-07', 'financialYear': '2024-25',
          'basis': 'Published geographically mapped GEN client records; unmappable addresses excluded. Absent rows are not asserted to be real-world zero recipients.',
          'programmes': results}
(ROOT / 'data' / 'aged-care-ranking-audit-2025.json').write_text(json.dumps(output, indent=2) + '\n')
print('Verified all six published LGA/SA3 tables and wrote the allocation controls')
