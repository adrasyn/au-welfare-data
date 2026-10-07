const integer = new Intl.NumberFormat('en-AU',{maximumFractionDigits:0});
const currency = new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0});

export function formatAUD(value,{compact=false,roundTo=1}={}) {
  if (value===null || value===undefined || !Number.isFinite(value)) return 'Unavailable';
  if(compact && Math.abs(value)>=1e6) return `$${(value/1e6).toLocaleString('en-AU',{maximumFractionDigits:1})}m`;
  return currency.format(Math.round(value/roundTo)*roundTo);
}

export function formatCount(count) {
  const unit=count.unit==='income-units'?'income units':count.unit;
  if(count.status==='suppressed') return count.displayBound ? `${count.displayBound} ${unit}` : `Suppressed ${unit}`;
  if(count.value===null || count.value===undefined) return `Unavailable ${unit}`;
  return `${count.status==='estimated'?'≈ ':''}${integer.format(count.value)} ${unit}`;
}

export function buildSummary(area,release={}) {
  const population=area.population;
  const perResidentAvailable=Number.isFinite(population?.value) && population.value>0 && population.geographyVintage===area.geographyVintage;
  const groups=area.groups.map(group=>({...group,
    perResident:{...group.spending,value:perResidentAvailable && group.spending.value!==null ? group.spending.value/population.value : null}}));
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
  return {area,groups,total:{value,status:value===null?'unavailable':'estimated',unit:'AUD'},
    totalPerResident:{value:perResidentAvailable && value!==null?value/population.value:null,status:'estimated',unit:'AUD'},
    totalLabel:incomplete?'Incomplete programme subtotal':overlap?'Programme subtotal':'Selected programme total',
    perResidentAvailable,incomplete,notes,releaseId:release.id??'2024-25-v1',financialYear:[...periods][0]??release.financialYear,
    countDate:release.countDate??'2025-06-30',populationDate:population?.period??release.populationDate};
}
