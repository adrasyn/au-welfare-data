import { allocationIssues } from '../dist/lib/model.mjs';

export function validateRelease(release) {
  const ids = new Set();
  for (const area of release.areas) {
    if (ids.has(area.id)) throw new Error(`Duplicate area ${area.id}`);
    ids.add(area.id);
    for (const group of area.groups ?? []) {
      if(group.spending) {
        const issues=allocationIssues(group,area,release);
        if(issues.length) throw new Error(`${area.id} ${group.id}: ${issues.join('; ')}`);
        if(group.components?.length && group.spending.value!==null && Math.abs(group.components.reduce((sum,c)=>sum+c.spending.value,0)-group.spending.value)>0.001) throw new Error('Component expenditure does not reconcile');
      }
      for (const count of group.counts ?? []) {
        if (['suppressed','unavailable'].includes(count.status) && count.value !== null) throw new Error('Suppressed/unavailable observations cannot contain an exact value');
        if (count.value !== null && (!Number.isFinite(count.value) || count.value < 0)) throw new Error('Invalid count');
      }
    }
  }
  return true;
}

export function parseCount(input, unit) {
  const text = String(input ?? '').trim().replaceAll(',', '');
  if (/^[<>]/.test(text)) return {value:null,status:'suppressed',displayBound:text,unit};
  if (text === '' || ['N/A','na','-','..','np'].includes(text)) return {value:null,status:'unavailable',displayBound:null,unit};
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid published count: ${text}`);
  return {value,status:'reported',displayBound:null,unit};
}

export function allocateCounts(records, correspondence) {
  const byFrom = new Map();
  for (const row of correspondence) {
    if (!Number.isFinite(row.ratio) || row.ratio < 0 || row.ratio > 1) throw new Error('Invalid correspondence ratio');
    const list = byFrom.get(row.from) ?? [];
    list.push(row); byFrom.set(row.from,list);
  }
  const result = new Map();
  for (const {code, count} of records) {
    const rows = byFrom.get(code);
    if (!rows) continue;
    for (const row of rows) {
      if (row.ratio === 0) continue;
      const previous = result.get(row.to);
      const suppressed = count.value === null || (previous && previous.value === null);
      const identity = rows.length === 1 && row.ratio === 1 && count.status === 'reported';
      result.set(row.to, {
        value: suppressed ? null : (previous?.value ?? 0) + count.value * row.ratio,
        status: suppressed ? 'suppressed' : (!identity || previous?.status === 'estimated' ? 'estimated' : 'reported'),
        displayBound: suppressed && !previous && identity ? count.displayBound : null,
        unit:count.unit
      });
    }
  }
  return result;
}
