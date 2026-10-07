import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { parseCount, allocateCounts, validateRelease } from './data-utils.mjs';

const root = new URL('../',import.meta.url);
const cache = new URL('.cache/sources/',root);
const json = async path=>JSON.parse(await readFile(new URL(path,cache),'utf8'));
const csv = async path=>parse(await readFile(new URL(path,cache)),{columns:true,bom:true,skip_empty_lines:true});
const abs=await json('abs-extracted.json');
const state=await json('dss-State.json');
const headers=state.find(r=>r[0]==='State');
const totals=state.find(r=>r[0]==='Total');
const national=Object.fromEntries(headers.map((key,i)=>[key,totals[i]]));
const stateLabels={'1':'NSW','2':'VIC','3':'QLD','4':'SA','5':'WA','6':'TAS','7':'NT','8':'ACT','9':'OT'};
const snapshot='2025-06-30';
const fiscal='2024-25';
const specs=[
  {id:'jobseeker',label:'JobSeeker Payment',short:'JobSeeker',components:[['JobSeeker Payment','People',15537.55,'people']],description:'Income support for people looking for work or temporarily unable to work. Formerly Newstart.'},
  {id:'youth',label:'Youth Allowance',short:'Youth Allowance',components:[['Youth Allowance (other)','Job seekers',1203.70,'people'],['Youth Allowance (student and apprentice)','Students & apprentices',1805.83,'people']],description:'Both job seeker and student/apprentice categories. Counts are shown separately.'},
  {id:'ndis',label:'NDIS',short:'NDIS',description:'Participant supports, including in-kind services. Excludes scheme administration.'},
  {id:'ftb',label:'Family Tax Benefit',short:'Family Tax Benefit',components:[['Family Tax Benefit A','Part A',13915.45,'families'],['Family Tax Benefit B','Part B',3998.80,'families']],description:'Parts A and B. Published counts are families receiving fortnightly instalments; they can overlap and exclude lump-sum-only recipients.'},
  {id:'cra',label:'Commonwealth Rent Assistance',short:'Rent Assistance',components:[['Commonwealth Rent Assistance','Recipient households',6419.7,'income-units']],nonAdditive:true,description:'Paid alongside other payments. Shown separately for context and not added to the programme subtotal, to avoid double counting.'},
  {id:'dsp',label:'Disability Support Pension',short:'Disability Support Pension',components:[['Disability Support Pension','People',23084.54,'people']],description:'Income support for people whose disability limits their capacity to work. Separate from NDIS.'},
  {id:'age',label:'Age Pension',short:'Age Pension',components:[['Age Pension','People',62186.78,'people']],description:'Income support for eligible older Australians. Source counts cover Services Australia recipients.'},
  {id:'parenting',label:'Parenting Payment',short:'Parenting Payment',components:[['Parenting Payment Single','Single',7156.90,'people'],['Parenting Payment Partnered','Partnered',896.03,'people']],description:'Single and Partnered categories, shown separately.'},
  {id:'carer',label:'Carer Payment',short:'Carer Payment',components:[['Carer Payment','People',8087.15,'people']],description:'Income support for carers. Excludes Carer Allowance and Carer Supplement.'}
];
const dss={};
for(const type of ['lga','ced']) {
  const key=`${type.toUpperCase()}_CODE_2024`;
  dss[type]=new Map((await csv(`dss-${type}.csv`)).filter(r=>r.DATE==='2025-06').map(r=>[r[key],r]));
}

// Resolve NDIS source identities against the official ABS source registry,
// then allocate across vintages with the published population ratios.
const chain=[
  ['CG_LGA_2020_LGA_2021.csv',2020,2021],
  ['CG_LGA_2021_LGA_2022.csv',2021,2022],
  ['CG_2022_LGA_2023_LGA.csv',2022,2023],
  ['CG_LGA_2023_LGA_2024.csv',2023,2024]
];
const first=await csv(chain[0][0]);
const oldNames=new Map(first.map(r=>[r.LGA_NAME_2020,r.LGA_CODE_2020]));
const ndisLgaRaw=(await csv('ndis-lga.csv')).filter(r=>r.ReportDt==='30JUN2025');
let ndisLga=new Map();
const unmatched=[];
for(const row of ndisLgaRaw) {
  const code=oldNames.get(row.LGANm2020);
  if(!code) {unmatched.push({name:row.LGANm2020,count:row.PrtcpntCnt});continue;}
  const count=parseCount(row.PrtcpntCnt,'participants');
  const prev=ndisLga.get(code);
  if(prev) {
    if(prev.value===null || count.value===null) ndisLga.set(code,{...count,value:null,status:'suppressed',displayBound:null});
    else ndisLga.set(code,{...count,value:prev.value+count.value});
  } else ndisLga.set(code,count);
}
for(const [filename,from,to] of chain) {
  const rows=(await csv(filename)).filter(r=>r.RATIO_FROM_TO.trim() && r[`LGA_CODE_${to}`].trim());
  ndisLga=allocateCounts([...ndisLga].map(([code,count])=>({code,count})),rows.map(r=>({from:r[`LGA_CODE_${from}`],to:r[`LGA_CODE_${to}`],ratio:Number(r.RATIO_FROM_TO)})));
}
const cedNames=new Map(Object.entries(abs.registry.ced).map(([code,r])=>[`${stateLabels[r.stateCode]}:${r.name}`,code]));
const ndisCed=new Map();
for(const row of (await csv('ndis-ced.csv')).filter(r=>r.RprtDt==='30JUN2025')) {
  const code=cedNames.get(`${row.StateCd}:${row.CEDNm2024}`);
  if(code) ndisCed.set(code,parseCount(row.PrtcpntCnt,'participants'));
}
const ndisNational=739414;
const ndisExpenditure=46352.178*1e6;

function observation(raw,unit,label) {
  return {...parseCount(raw,unit),label,period:snapshot,sourceId:'dss-june2025'};
}
function groupFor(spec,row,ndisCount,type) {
  let counts, value, components=[];
  const geographyVintage=`${type.toUpperCase()}2024`;
  if(spec.id==='ndis') {
    const count=ndisCount??parseCount(null,'participants');
    counts=[{...count,label:'Participants',period:snapshot,sourceId:'ndis-june2025',geographyVintage:type==='lga'?'LGA2024':'CED2024',method:type==='lga'?'ABS LGA2020 → LGA2024 correspondences':'Published CED2024 count'}];
    value=count.value===null?null:count.value/ndisNational*ndisExpenditure;
  } else {
    counts=spec.components.map(([field,label,,unit])=>({...observation(row?.[field],unit,label),geographyVintage}));
    components=spec.components.map(([field,label,amount],i)=>{
      const value=counts[i].value===null?null:amount*1e6*counts[i].value/national[field];
      return {label,count:counts[i],spending:{value,status:value===null?'unavailable':'estimated',unit:'AUD',period:fiscal,geographyVintage}};
    });
    value=counts.some(c=>c.value===null)?null:components.reduce((sum,c)=>sum+c.spending.value,0);
  }
  return {id:spec.id,label:spec.label,short:spec.short,description:spec.description,counts,components,
    spending:{value,status:value===null?'unavailable':'estimated',unit:'AUD',period:fiscal,geographyVintage},financialYear:fiscal,allocationCountDate:snapshot,
    additive:!spec.nonAdditive,overlapHandled:spec.id==='cra',includesRentAssistance:spec.id!=='ndis'&&spec.id!=='cra'};
}
const areas=[];
const byAreaPostcodes=new Map();
for(const [pc,groups] of Object.entries(abs.postcodes)) {
  for(const [type,codes] of Object.entries(groups)) for(const code of codes) {
    const id=`${type}:${code}`;
    const list=byAreaPostcodes.get(id)??[];list.push(pc);byAreaPostcodes.set(id,list);
  }
}
for(const type of ['ced','lga']) for(const [code,p] of Object.entries(abs.population[type])) {
  const registry=abs.registry[type][code];
  if(!registry) throw new Error(`Missing ABS registry for ${type}:${code}`);
  const area={id:`${type}:${code}`,code,name:registry.name,state:stateLabels[registry.stateCode],stateName:registry.stateName,type,
    geographyVintage:`${type.toUpperCase()}2024`,postcodes:byAreaPostcodes.get(`${type}:${code}`)??[],
    population:{value:p.population,period:'2024-06-30',status:'reported',geographyVintage:`${type.toUpperCase()}2024`,sourceId:'abs-erp2024'},
    groups:specs.map(spec=>groupFor(spec,dss[type].get(code),(type==='lga'?ndisLga:ndisCed).get(code),type))};
  areas.push(area);
}
const sources=[
  {id:'dss-june2025',title:'DSS recipients, June 2025',url:'https://data.gov.au/data/dataset/dss-payment-demographic-data'},
  {id:'dss-expenditure',title:'DSS Annual Report 2024–25, Table A-6',url:'https://www.dss.gov.au/system/files/documents/2025-11/department-social-services-annual-report-2024-25.pdf'},
  {id:'ndis-june2025',title:'NDIS participant datasets',url:'https://dataresearch.ndis.gov.au/datasets/participant-datasets'},
  {id:'ndis-expenditure',title:'NDIA Annual Report 2024–25, Note 1.1G',url:'https://ndis.gov.au/media/8108/download?attachment='},
  {id:'cra-expenditure',title:'Productivity Commission RoGS 2026, Table GA.4',url:'https://www.pc.gov.au/ongoing/report-on-government-services/housing-homelessness/'},
  {id:'abs-erp2024',title:'ABS resident population, June 2024',url:'https://www.abs.gov.au/statistics/people/population/regional-population/2023-24'},
  {id:'abs-correspondence',title:'ABS geography correspondences',url:'https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/correspondences'},
  {id:'abs-postcodes',title:'ABS Postal Area and Mesh Block allocations',url:'https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/allocation-files'},
  {id:'cra-overlap',title:'DSS Budget 2025–26, p35: Rent Assistance is included in primary payments',url:'https://www.dss.gov.au/system/files/documents/2025-03/2025-26social-servicespbsaccessible.pdf'}
];
const release={id:'2024-25-v1',financialYear:fiscal,countDate:snapshot,populationDate:'2024-06-30',publishedAt:'2026-10-07',areas,sources,
  methodology:{allocation:'Local expenditure is estimated as national annual programme expenditure × local share of the published June 2025 recipient population. It assumes the same spending distribution as recipient counts; local payment rates can differ. It is not reported local expenditure.',
    counts:'DSS rounds counts to the nearest five and includes suspended/zero-rate recipients. FTB counts cover fortnightly instalment families only; spending includes all annual FTB expenditure, so these counts are an allocation proxy. Income units can share a dwelling. NDIS suppressed values remain unavailable.',
    geography:'NDIS council counts are converted from LGA2020 using the four official ABS annual correspondence tables. Converted counts are labelled estimates. Electorate counts use the published CED2024 source. Postcodes use ABS POA2021 Mesh Block membership, not an address lookup.',
    overlap:'Rent Assistance is embedded in primary payment expenditure. Its cross-program estimate is displayed for context and excluded from addition. Some CRA is paid with programmes outside this selection; do not interpret the subtotal as all Australian welfare spending.',
    population:'Per-resident values use the ABS June 2024 resident population on 2024 boundaries. Expenditure covers FY2024–25 and recipients are the June 2025 snapshot. NDIS includes nationally funded participant supports and in-kind services; administration is excluded.'}};
validateRelease(release);
await mkdir(new URL('dist/data/releases/',root),{recursive:true});
await writeFile(new URL(`dist/data/releases/${release.id}.json`,root),JSON.stringify(release));
await writeFile(new URL('dist/data/current.json',root),JSON.stringify({release:release.id}));
const audit={areas:areas.length,ced:areas.filter(a=>a.type==='ced').length,lga:areas.filter(a=>a.type==='lga').length,postcodes:Object.keys(abs.postcodes).length,
  missingDss:areas.filter(a=>!dss[a.type].has(a.code)).map(a=>a.id),missingNdis:areas.filter(a=>a.groups.find(g=>g.id==='ndis').counts[0].status==='unavailable').map(a=>a.id),
  suppressedNdis:areas.filter(a=>a.groups.find(g=>g.id==='ndis').counts[0].status==='suppressed').length,unmatchedNdisSource:unmatched,nationalDenominators:national};
await writeFile(new URL('data/preparation-audit.json',root),JSON.stringify(audit,null,2));
console.log(JSON.stringify({release:release.id,areas:audit.areas,postcodes:audit.postcodes,missingDss:audit.missingDss,missingNdis:audit.missingNdis,suppressedNdis:audit.suppressedNdis}));
