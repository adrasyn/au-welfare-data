import {scopeFor} from './scopes.mjs';
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
  if(count.value===null || count.value===undefined) return (Number.isFinite(count.knownSubtotal)&&count.knownSubtotal>=0)?`Known ≈ ${integer.format(count.knownSubtotal)} ${unit} · incomplete`:`Unavailable ${unit}`;
  return `${count.status==='estimated'?'≈ ':''}${integer.format(count.value)} ${unit}`;
}
export function formatMoneyObservation(observation,options={}) {
  if(Number.isFinite(observation.value))return formatAUD(observation.value,options);
  return (Number.isFinite(observation.knownSubtotal)&&observation.knownSubtotal>=0)?`Known ${formatAUD(observation.knownSubtotal,options)} · incomplete`:'Unavailable';
}

export function formatSourceDate(date) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date??'')) return 'Unavailable date';
  return new Intl.DateTimeFormat('en-AU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));
}

export const recipientMetrics=[
  {id:'jobseeker',group:'jobseeker',label:'JobSeeker Payment',indices:[0],unit:'people'},
  {id:'youth',group:'youth',label:'Youth Allowance',indices:[0,1],unit:'people'},
  {id:'ndis',group:'ndis',label:'NDIS',indices:[0],unit:'participants'},
  {id:'ftb-a',group:'ftb',label:'Family Tax Benefit Part A',indices:[0],unit:'families'},
  {id:'ftb-b',group:'ftb',label:'Family Tax Benefit Part B',indices:[1],unit:'families'},
  {id:'cra',group:'cra',label:'Rent Assistance',indices:[0],unit:'income-units'},
  {id:'aged-care-residential',group:'aged-care-residential',label:'Residential aged care (facility location)',indices:[0],unit:'people'},
  {id:'aged-care-home',group:'aged-care-home',label:'Home-care packages',indices:[0],unit:'people'},
  {id:'aged-care-support',group:'aged-care-support',label:'Home support (annual clients)',indices:[0],unit:'people'},
  {id:'dsp',group:'dsp',label:'Disability Support Pension',indices:[0],unit:'people'},
  {id:'age',group:'age',label:'Age Pension',indices:[0],unit:'people'},
  {id:'parenting',group:'parenting',label:'Parenting Payment',indices:[0,1],unit:'people'},
  {id:'carer',group:'carer',label:'Carer Payment',indices:[0],unit:'people'}
];

function recipientRate(count,population,geographyVintage) {
  const unit=['people','participants'].includes(count.unit)?'percent':count.unit==='families'?'families-per-1000':'income-units-per-1000';
  const available=Number.isFinite(count.value)&&count.value>=0&&!['suppressed','unavailable'].includes(count.status)&&Number.isFinite(population?.value)&&population.value>0&&population.geographyVintage===geographyVintage;
  return {value:available?count.value/population.value*(unit==='percent'?100:1000):null,unit,status:available?'estimated':'unavailable',coverage:count.countCoverage,period:count.period};
}

export function formatRecipientRate(rate,{compact=false}={}) {
  if(!Number.isFinite(rate?.value))return 'Rate unavailable';
  const value=rate.value>0&&rate.value<0.1?'<0.1':rate.value.toLocaleString('en-AU',{minimumFractionDigits:1,maximumFractionDigits:1});
  const period=rate.coverage==='annual'?` · FY${rate.period?.replace('-','–')}`:'';
  if(rate.unit==='percent')return (compact?`${value}%`:`${value}% of residents`)+period;
  const units=rate.unit==='families-per-1000'?'families':'income units';
  return compact?`${value} / 1,000`:`${value} ${units} per 1,000 residents`;
}

export function allocationIssues(group,area,release={}) {
  const issues=[];
  if(!group.financialYear || group.spending?.period!==group.financialYear || (release.financialYear && group.financialYear!==release.financialYear)) issues.push('spending period does not match the financial year');
  if(group.spending?.unit!=='AUD') issues.push('spending currency is unavailable or incompatible');
  if(group.spending?.geographyVintage!==area.geographyVintage) issues.push('spending geography does not match this area');
  const annual=group.countCoverage==='annual'&&group.allocationCountDate===group.financialYear;
  if(group.countCoverage==='annual'&&!annual)issues.push('annual recipient period does not match the financial year');
  if(!group.allocationCountDate || (!annual && release.countDate && group.allocationCountDate!==release.countDate) || group.counts.some(c=>c.period!==group.allocationCountDate)) issues.push('recipient snapshot date does not match the allocation date');
  if(group.counts.some(c=>c.geographyVintage!==area.geographyVintage)) issues.push('recipient geography does not match this area');
  return issues;
}

export function buildSummary(area,release={}) {
  const population=area.population;
  const perResidentAvailable=Number.isFinite(population?.value) && population.value>0 && population.geographyVintage===area.geographyVintage && (!release.populationDate||population.period===release.populationDate);
  const groups=area.groups.map(group=>{
    const issues=allocationIssues(group,area,release);
    const spending=issues.length?{...group.spending,value:null,knownSubtotal:undefined,status:'unavailable'}:group.spending;
    const counts=group.counts.map(count=>{
      const annual=group.countCoverage==='annual'&&group.allocationCountDate===group.financialYear;
      const safe=(group.countCoverage==='annual'&&!annual) || count.geographyVintage!==area.geographyVintage || count.period!==group.allocationCountDate || (!annual && release.countDate && count.period!==release.countDate)?{...count,value:null,knownSubtotal:undefined,status:'unavailable',displayBound:null}:count;
      return {...safe,rate:recipientRate({...safe,countCoverage:group.countCoverage},perResidentAvailable?population:null,area.geographyVintage)};
    });
    const components=group.components?.map(component=>({...component,spending:issues.length?{...component.spending,value:null,status:'unavailable'}:component.spending}));
    return {...group,counts,spending,components,issues,
      perResident:{...spending,value:perResidentAvailable && spending.value!==null?spending.value/population.value:null,knownSubtotal:perResidentAvailable&&(Number.isFinite(spending.knownSubtotal)&&spending.knownSubtotal>=0)?spending.knownSubtotal/population.value:undefined}};
  });
  const additive=groups.filter(g=>g.additive!==false);
  const periods=new Set(groups.map(g=>g.financialYear));
  const mixedPeriods=periods.size>1;
  const incomplete=additive.some(g=>g.spending.value===null);
  const overlap=groups.some(g=>g.additive===false);
  const value=mixedPeriods?null:additive.reduce((sum,g)=>sum+(Number.isFinite(g.spending.value)?g.spending.value:(Number.isFinite(g.spending.knownSubtotal)&&g.spending.knownSubtotal>=0)?g.spending.knownSubtotal:0),0);
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
  const recipientMeasures=recipientMetrics.map(metric=>{
    const group=groups.find(group=>group.id===metric.group);
    const counts=metric.indices.map(index=>group?.counts[index]);
    const available=counts.every(count=>count&&Number.isFinite(count.value)&&count.unit===metric.unit&&!['suppressed','unavailable'].includes(count.status));
    const count={value:available?counts.reduce((sum,count)=>sum+count.value,0):null,unit:metric.unit,status:available?(counts.some(count=>count.status==='estimated')?'estimated':'reported'):'unavailable',countCoverage:group?.countCoverage,period:group?.allocationCountDate};
    return {...metric,count,countCoverage:group?.countCoverage,rate:recipientRate(count,perResidentAvailable?population:null,area.geographyVintage)};
  });
  return {area,groups,scope:scopeFor(release.scope?.id),total:{value,status:value===null?'unavailable':'estimated',unit:'AUD'},
    totalPerResident:{value:perResidentAvailable && value!==null?value/population.value:null,status:'estimated',unit:'AUD'},
    totalLabel:incomplete?'Incomplete programme subtotal':overlap?'Programme subtotal':'Selected programme total',
    perResidentAvailable,incomplete,notes,issues,recipientMeasures,releaseId:release.id??'2024-25-v1',financialYear:release.financialYear??[...periods][0],
    countDate:release.countDate??'2025-06-30',populationDate:population?.period??release.populationDate};
}
