import {buildSummary,recipientMetrics} from './model.mjs';

export function buildRankings(release,type,metricId='spending') {
  const metric=recipientMetrics.find(metric=>metric.id===metricId);
  if(metricId!=='spending'&&!metric)throw new Error('Unknown ranking payment');
  const rows=release.areas.filter(area=>area.type===type).map(area=>{
    const summary=buildSummary(area,release);
    const measure=summary.recipientMeasures.find(measure=>measure.id===metricId);
    const sortValue=metric?measure.rate.value:summary.total.value;
    return {area,total:summary.total,rate:measure?.rate,count:measure?.count,populationAvailable:summary.perResidentAvailable,sortValue,eligible:Number.isFinite(sortValue)&&(Boolean(metric)||!summary.incomplete),rank:null};
  });
  const nameOrder=(a,b)=>a.area.name.localeCompare(b.area.name,'en-AU')||a.area.state.localeCompare(b.area.state,'en-AU')||a.area.id.localeCompare(b.area.id);
  const ranked=rows.filter(row=>row.eligible).sort((a,b)=>b.sortValue-a.sortValue||nameOrder(a,b));
  for(let i=0;i<ranked.length;i++) ranked[i].rank=i>0&&ranked[i].sortValue===ranked[i-1].sortValue?ranked[i-1].rank:i+1;
  const unranked=rows.filter(row=>!row.eligible).sort(nameOrder);
  return {rows:[...ranked,...unranked],rankedCount:ranked.length,totalCount:rows.length,metric};
}
