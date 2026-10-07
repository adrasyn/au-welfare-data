import {readFile,writeFile} from 'node:fs/promises';
import {validateRelease} from './data-utils.mjs';

// Preserve v1/v2 figures for existing shared links. Only the accounting policy changes.
const original=JSON.parse(await readFile(new URL('../dist/data/releases/2024-25-v2.json',import.meta.url)));
const overlapNote='Residential aged care and NDIS are both included at their published programme amounts. NDIS reimburses some residential aged-care subsidies, so the combined total may count that spending twice. The NDIA’s 2024–25 Annual Financial Sustainability Report (page 220) says off-system payments, including residential aged care and taxi subsidies, account for less than 1% of NDIS expenditure. This indicates a small national overlap, but does not give its exact annual amount or its distribution between areas. No deduction is made for this overlap; spending and per-person rankings use the same gross totals. Home care and CHSP direct services are included; administration, flexible programmes and private fees are outside this selection.';
const release={...original,id:'2024-25-v3',publishedAt:'2026-10-07',areas:original.areas.map(area=>({...area,groups:area.groups.map(group=>group.id==='aged-care-residential'?{...group,additive:true,overlapPolicy:'include-gross',nonAdditiveNote:undefined,description:'Permanent and respite care. Counts use facility locations at 30 June 2025, allocated using official ABS population correspondences; they are geographic estimates. Spending includes Commonwealth and DVA mainstream residential care. It is included in totals. Some subsidies are reimbursed by NDIS; the overlap is explained in the calculation methodology and is not deducted.'}:group)})),
  sources:[...original.sources,{id:'ndis-off-system-scale',title:'NDIA 2024–25 actuarial report, p220: scale of residential aged-care and other off-system payments',url:'https://www.ndis.gov.au/media/8183/download?attachment='}],
  methodology:{...original.methodology,overlap:'Rent Assistance is embedded in primary payment expenditure. Its separate estimate is excluded to avoid counting the same spending twice. Some Rent Assistance is paid with programmes outside this selection. '+overlapNote}};
validateRelease(release);
await writeFile(new URL('../dist/data/releases/'+release.id+'.json',import.meta.url),JSON.stringify(release));
await writeFile(new URL('../dist/data/current.json',import.meta.url),JSON.stringify({release:release.id}));
console.log(`Created ${release.id}: residential aged care included, reimbursement overlap not deducted`);
