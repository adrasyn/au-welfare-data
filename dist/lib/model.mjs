const integer = new Intl.NumberFormat('en-AU',{maximumFractionDigits:0});
const currency = new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0});

export function formatAUD(value,{compact=false,roundTo=1}={}) {
  if (value===null || value===undefined || !Number.isFinite(value)) return 'Unavailable';
  if(compact && Math.abs(value)>=1e9) return `$${(value/1e9).toLocaleString('en-AU',{maximumFractionDigits:1})}b`;
  if(compact && Math.abs(value)>=1e6) return `$${(value/1e6).toLocaleString('en-AU',{maximumFractionDigits:1})}m`;
  return currency.format(Math.round(value/roundTo)*roundTo);
}

export function formatCount(count) {
  const unit=count.unit==='income-units'?'income units':count.unit;
  if(count.status==='suppressed') return count.displayBound ? `${count.displayBound} ${unit}` : `Suppressed ${unit}`;
  if(count.value===null || count.value===undefined) return `Unavailable ${unit}`;
  return `${count.status==='estimated'?'≈ ':''}${integer.format(count.value)} ${unit}`;
}

export function formatSourceDate(date) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date??'')) return 'Unavailable date';
  return new Intl.DateTimeFormat('en-AU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));
}

export function allocationIssues(group,area,release={}) {
  const issues=[];
  if(!group.financialYear || group.spending?.period!==group.financialYear || (release.financialYear && group.financialYear!==release.financialYear)) issues.push('spending period does not match the financial year');
  if(group.spending?.unit!=='AUD') issues.push('spending currency is unavailable or incompatible');
  if(group.spending?.geographyVintage!==area.geographyVintage) issues.push('spending geography does not match this area');
  if(!group.allocationCountDate || (release.countDate && group.allocationCountDate!==release.countDate) || group.counts.some(c=>c.period!==group.allocationCountDate)) issues.push('recipient snapshot date does not match the allocation date');
  if(group.counts.some(c=>c.geographyVintage!==area.geographyVintage)) issues.push('recipient geography does not match this area');
  return issues;
}

export function buildSummary(area,release={}) {
  const population=area.population;
  const perResidentAvailable=Number.isFinite(population?.value) && population.value>0 && population.geographyVintage===area.geographyVintage;
  const groups=area.groups.map(group=>{
    const issues=allocationIssues(group,area,release);
    const spending=issues.length?{...group.spending,value:null,status:'unavailable'}:group.spending;
    const counts=group.counts.map(count=>count.geographyVintage!==area.geographyVintage || count.period!==group.allocationCountDate || (release.countDate && count.period!==release.countDate)?{...count,value:null,status:'unavailable',displayBound:null}:count);
    const components=group.components?.map(component=>({...component,spending:issues.length?{...component.spending,value:null,status:'unavailable'}:component.spending}));
    return {...group,counts,spending,components,issues,
      perResident:{...spending,value:perResidentAvailable && spending.value!==null?spending.value/population.value:null}};
  });
  const additive=groups.filter(g=>g.additive!==false);
  const periods=new Set(groups.map(g=>g.financialYear));
  const mixedPeriods=periods.size>1;
  const incomplete=additive.some(g=>g.spending.value===null);
  const overlap=groups.some(g=>g.additive===false);
  const value=mixedPeriods?null:additive.filter(g=>Number.isFinite(g.spending.value)).reduce((sum,g)=>sum+g.spending.value,0);
  const notes=[
    'Local spending is estimated from national expenditure and recipient shares; it is not reported local expenditure.',
    'Counts are a snapshot. A person can receive more than one payment; counts are not added together.',
    'DSS counts are rounded to the nearest five. FTB counts cover fortnightly instalment families only.',
    'Per-resident figures use the dated ABS resident population and include all residents, not only recipients.'
  ];
  if(overlap) notes.push('Rent Assistance is funded within primary payments. Its separate cross-program estimate is not added to the programme subtotal.');
  if(incomplete) notes.push('This subtotal is incomplete because one or more programme spending estimates are unavailable.');
  if(mixedPeriods) notes.push('A subtotal cannot be calculated across different financial years.');
  if(!perResidentAvailable) notes.push('Per-resident values are unavailable because a compatible positive population estimate is missing.');
  const issues=groups.flatMap(group=>group.issues.map(issue=>`${group.label}: ${issue}. This spending estimate is withheld.`));
  if(!perResidentAvailable) issues.push('Per-resident values are unavailable because a compatible positive population estimate is missing. The area invoice remains available.');
  return {area,groups,total:{value,status:value===null?'unavailable':'estimated',unit:'AUD'},
    totalPerResident:{value:perResidentAvailable && value!==null?value/population.value:null,status:'estimated',unit:'AUD'},
    totalLabel:incomplete?'Incomplete programme subtotal':overlap?'Programme subtotal':'Selected programme total',
    perResidentAvailable,incomplete,notes,issues,releaseId:release.id??'2024-25-v1',financialYear:release.financialYear??[...periods][0],
    countDate:release.countDate??'2025-06-30',populationDate:population?.period??release.populationDate};
}
