import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateRelease} from './data-utils.mjs';

const controls={
  'aged-care-residential':{budget:23965600000,count:203624},
  'aged-care-home':{budget:8659900000,count:291435},
  'aged-care-support':{budget:3270000000,count:834278}
};
const basis='published-mapped-client-share';
const coverageNote='Spending is a modelled allocation using published, geographically mapped client shares. Recipient-count coverage remains incomplete; no additional recipients are inferred.';

export function createMappedCareRelease(original,audit,manifest){
  if(original.id!=='2024-25-v3'||original.financialYear!==audit.financialYear)throw new Error('Source release/audit period mismatch');
  validateRelease(original);
  for(const [id,control] of Object.entries(controls)){
    const evidence=audit.programmes[id];
    const source=manifest.entries.find(entry=>entry.filename===evidence?.sourceFile);
    if(!source||source.sha256!==evidence.sha256)throw new Error(`${id}: source hash does not match the audit`);
    if(evidence.nationalMappedCount!==control.count||evidence.tables.length!==2||!evidence.tables.some(t=>t.sheet.includes('(SA3)'))||!evidence.tables.some(t=>t.sheet.includes('(LGA)'))||evidence.tables.some(t=>t.nonNumericTotalCells!==0||t.numericTotal!==control.count||t.rows<=0))throw new Error(`${id}: published source table controls fail the audit`);
  }
  const release={...structuredClone(original),id:'2024-25-v4',publishedAt:audit.verifiedAt};
  for(const area of release.areas){
    for(const group of area.groups.filter(g=>g.id.startsWith('aged-care-'))){
      const control=controls[group.id],count=group.counts[0];
      if(!control||group.allocation.nationalExpenditure!==control.budget||group.allocation.denominator!==control.count)throw new Error(`${area.id} ${group.id}: allocation controls do not reconcile`);
      if(count.status==='suppressed')throw new Error(`${area.id} ${group.id}: suppressed count provenance cannot qualify`);
      const mappedCount=count.value??count.knownSubtotal;
      const allocation=group.spending.value??group.spending.knownSubtotal;
      if(Number.isFinite(allocation)&&(!Number.isFinite(mappedCount)||Math.abs(allocation-control.budget*mappedCount/control.count)>0.001))throw new Error(`${area.id} ${group.id}: allocation arithmetic does not reconcile`);
      const partial=count.value===null;
      if(group.spending.value===null&&Number.isFinite(allocation)){
        if(count.status!=='unavailable'||!Number.isFinite(count.knownSubtotal))throw new Error(`${area.id} ${group.id}: partial count provenance is unavailable`);
        group.spending={...group.spending,value:allocation,status:'estimated'};
        delete group.spending.knownSubtotal;
      }
      if(Number.isFinite(group.spending.value))group.spending.basis=basis;
      group.allocation={...group.allocation,method:basis,countCoverageIncomplete:partial,sourceAudit:'aged-care-ranking-audit-2025',sourceSha256:audit.programmes[group.id].sha256};
      if(partial)group.description+=' '+coverageNote;
    }
  }
  // The whole published mapped budget is already allocated, within less than one
  // client's expenditure from outside-registry transfers/ABS ratio precision.
  // This arithmetic check does not establish complete real-world client coverage.
  const reconciliation={};
  for(const [id,control] of Object.entries(controls)){
    reconciliation[id]={};
    for(const type of ['ced','lga']){
      const allocated=release.areas.filter(a=>a.type===type).reduce((sum,a)=>{
        const spending=a.groups.find(g=>g.id===id).spending;
        return sum+(spending.value??spending.knownSubtotal??0);
      },0);
      if(Math.abs(allocated-control.budget)>control.budget/control.count)throw new Error(`${id} ${type}: national allocation does not reconcile`);
      reconciliation[id][type]={nationalExpenditure:control.budget,allocatedEstimate:allocated,residual:control.budget-allocated};
    }
  }
  release.allocationAudit={sourceAudit:'aged-care-ranking-audit-2025',reconciliation};
  release.methodology.allocation+=' Aged-care spending estimates use the complete set of published, geographically mapped client records. Some recipient counts remain incomplete, but the published-data model still produces a spending allocation. Unlocated clients are assumed to have the same spending distribution as mapped clients. Spending and per-person rankings compare these allocation estimates, rather than audited local expenditure. Explicitly suppressed source values or unavailable primary-payment spending remain ineligible. Budget reconciliation checks allocation arithmetic, not completeness of recipient coverage.';
  release.methodology.geography=release.methodology.geography.replace('Missing source rows remain unavailable.','Missing source rows remain unavailable in recipient counts. An absent source row is not asserted to be an observed zero. Aged-care spending may still have a modelled allocation based on published mapped client shares; incomplete recipient rates remain unranked.');
  validateRelease(release);
  return release;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
  const release=createMappedCareRelease(await read('dist/data/releases/2024-25-v3.json'),await read('data/aged-care-ranking-audit-2025.json'),await read('data/aged-care-source-manifest.json'));
  await writeFile(new URL('../dist/data/releases/'+release.id+'.json',import.meta.url),JSON.stringify(release));
  await writeFile(new URL('../dist/data/current.json',import.meta.url),JSON.stringify({release:release.id}));
  console.log(`Created ${release.id}: spending allocation estimates ranked independently of recipient-count coverage`);
}
