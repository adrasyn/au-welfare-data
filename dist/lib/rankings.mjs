import {buildSummary} from './model.mjs';

export function buildRankings(release,type) {
  const rows=release.areas.filter(area=>area.type===type).map(area=>{
    const summary=buildSummary(area,release);
    return {area,total:summary.total,eligible:!summary.incomplete&&Number.isFinite(summary.total.value),rank:null};
  });
  const nameOrder=(a,b)=>a.area.name.localeCompare(b.area.name,'en-AU')||a.area.state.localeCompare(b.area.state,'en-AU')||a.area.id.localeCompare(b.area.id);
  const ranked=rows.filter(row=>row.eligible).sort((a,b)=>b.total.value-a.total.value||nameOrder(a,b));
  for(let i=0;i<ranked.length;i++) ranked[i].rank=i>0&&ranked[i].total.value===ranked[i-1].total.value?ranked[i-1].rank:i+1;
  const unranked=rows.filter(row=>!row.eligible).sort(nameOrder);
  return {rows:[...ranked,...unranked],rankedCount:ranked.length,totalCount:rows.length};
}
