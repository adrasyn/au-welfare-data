import {readFile,writeFile} from 'node:fs/promises';
import {validateRelease} from './data-utils.mjs';

const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const original=await read('dist/data/releases/2024-25-v1.json');
const care=await read('data/aged-care-counts-2025.json');
const specs={
  'aged-care-residential':{label:'Residential aged care',amount:23965.6,overlapWith:'ndis',description:'Permanent and respite care. Counts use facility locations at 30 June 2025, allocated to current areas using ABS population correspondences; they are geographic estimates. Spending includes Commonwealth and DVA mainstream residential care. It is shown separately from All welfare subtotals because NDIS can reimburse the same care; retirement totals include it.'},
  'aged-care-home':{label:'Home-care packages',amount:8659.9,description:'Government-funded Home Care Packages in 2024–25. Recipient-location counts at 30 June 2025 are allocated using ABS correspondences. Spending is estimated from each area’s share of mapped clients. These historical packages were replaced by Support at Home after this reporting year.'},
  'aged-care-support':{label:'Home support (CHSP)',amount:3270.0,description:'Commonwealth Home Support Programme direct services. Counts are people served throughout FY2024–25, not a June snapshot. The spending estimate excludes separately funded initiatives and uses each area’s share of mapped annual clients. People can also use other care programmes.'}
};
const areas=original.areas.map(area=>({...area,groups:[...area.groups,...care.programmes.map(programme=>{
  const spec=specs[programme.id];
  const sourceCount=programme.counts[area.type][area.code];
  const count={...sourceCount,label:'People',period:programme.countDate,geographyVintage:area.geographyVintage,sourceId:programme.id,method:'Official ABS correspondence ratios; geographic estimate'};
  const value=count.value===null?null:spec.amount*1e6*count.value/programme.nationalCount;
  return {id:programme.id,label:spec.label,short:spec.label,description:spec.description,
    counts:[count],components:[],countCoverage:programme.countCoverage,locationBasis:programme.locationBasis==='service location'?'service':'recipient',
    financialYear:original.financialYear,allocationCountDate:programme.countDate,additive:!spec.overlapWith,overlapWith:spec.overlapWith,nonAdditiveNote:spec.overlapWith?'Shown separately: can overlap NDIS':undefined,
    spending:{value,knownSubtotal:Number.isFinite(count.knownSubtotal)?spec.amount*1e6*count.knownSubtotal/programme.nationalCount:undefined,status:value===null?'unavailable':'estimated',unit:'AUD',period:original.financialYear,geographyVintage:area.geographyVintage},
    allocation:{nationalExpenditure:spec.amount*1e6,denominator:programme.nationalCount,denominatorBasis:programme.nationalCountBasis,coverageNote:programme.coverageNote}
  };
})]}));
const sources=[...original.sources,
  {id:'aged-care-counts',title:'AIHW GEN aged-care recipients by region, 2024–25 / June 2025',url:'https://www.gen-agedcaredata.gov.au/resources/access-data/2026/february/gen-data-people-using-aged-care-by-region'},
  {id:'aged-care-expenditure',title:'2024–25 Operation of the Aged Care Act: tables 6, 10, 15, 26 and 27',url:'https://www.gen-agedcaredata.gov.au/getmedia/cd6a26e3-f236-469b-859b-0e164fa46702/25256-Health-and-Aged-Care-ROACA24-25-WEB'},
  {id:'aged-care-abs2021',title:'ABS ASGS 2021 official correspondence archive',url:'https://data.gov.au/data/dataset/2c79581f-600e-4560-80a8-98adb1922dfc/resource/33d822ba-138e-47ae-a15f-460279c3acc3/download/asgs2021correspondences.zip'},
  {id:'aged-care-abs2016',title:'ABS ASGS 2016 official correspondence archive',url:'https://data.gov.au/data/dataset/23fe168c-09a7-42d2-a2f9-fd08fbd0a4ce/resource/951e18c7-f187-4c86-a73f-fcabcd19af16/download/asgs2016correspondences.zip'},
  {id:'aged-care-ndis-overlap',title:'NDIA: residential aged-care subsidies and supplements reimbursed by NDIS',url:'https://ourguidelines.ndis.gov.au/supports-you-can-access-menu/home-and-living-supports/younger-people-residential-aged-care/what-residential-aged-care-fees-and-charges-do-we-fund'}];
const release={...original,id:'2024-25-v2',publishedAt:'2026-10-07',areas,sources,methodology:{...original.methodology,
  allocation:original.methodology.allocation+' Aged-care estimates allocate matched national programme spending by geographically mapped GEN client shares. Unknown addresses are absent from this allocation proxy; it assumes their spending distribution resembles mapped clients. No exact unknown-address spending residual is available.',
  counts:original.methodology.counts+' Home care and residential care are June 2025 snapshots; CHSP counts people served throughout FY2024–25. Care programmes overlap and their counts are never added as unique people.',
  geography:original.methodology.geography+' Aged-care conversions use official ABS correspondence chains from source LGA/SA3 vintages. All converted counts are geographic estimates. Residential care is located by facilities; home care and support by recipients. Missing source rows remain unavailable.',
  overlap:original.methodology.overlap+' Residential aged care can overlap NDIS reimbursements, so All welfare subtotals and their ranks exclude it. Retirement subtotals include it because NDIS is outside that group. The two group totals therefore do not simply add to the All subtotal. Home care and CHSP direct services are included; administration, flexible programmes and private fees are outside this selection.'}};
validateRelease(release);
await writeFile(new URL('../dist/data/releases/'+release.id+'.json',import.meta.url),JSON.stringify(release));
await writeFile(new URL('../dist/data/current.json',import.meta.url),JSON.stringify({release:release.id}));
console.log(JSON.stringify({release:release.id,areas:areas.length,programmes:areas[0].groups.length}));
