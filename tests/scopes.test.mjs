import test from 'node:test';
import assert from 'node:assert/strict';
import {filterRelease,scopeFor} from '../dist/lib/scopes.mjs';
import {buildSummary,allocationIssues} from '../dist/lib/model.mjs';
import {buildRankings} from '../dist/lib/rankings.mjs';
import {areaLink,documentContent,exportFilename} from '../dist/lib/render.mjs';
import {validateRelease} from '../scripts/data-utils.mjs';
import {readAreaLink} from '../dist/lib/urls.mjs';

const group=(id,value=100)=>({id,label:id,financialYear:'2024-25',allocationCountDate:'2025-06-30',additive:id!=='cra',spending:{value,unit:'AUD',period:'2024-25',geographyVintage:'LGA2024'},counts:[{value:10,label:'People',unit:'people',period:'2025-06-30',geographyVintage:'LGA2024'}]});
const area=(name,groups)=>({id:`lga:${name}`,name,type:'lga',state:'NSW',geographyVintage:'LGA2024',population:{value:1000,period:'2024-06-30',geographyVintage:'LGA2024'},groups});
const release={id:'test',financialYear:'2024-25',countDate:'2025-06-30',populationDate:'2024-06-30',areas:[area('a',[group('jobseeker',300),group('age',200),group('aged-care-home',100),group('cra',50),group('ndis',null)])]};

test('programme scopes filter the same area without mutating the published release',()=>{
  const retirement=filterRelease(release,'retirement');
  assert.deepEqual(retirement.areas[0].groups.map(g=>g.id),['age','aged-care-home','cra']);
  assert.deepEqual(filterRelease(release,'working').areas[0].groups.map(g=>g.id),['jobseeker','cra','ndis']);
  assert.equal(release.areas[0].groups.length,5);
  assert.equal(scopeFor('unknown').id,'all');
});
test('retirement totals exclude working-age programmes and never add Rent Assistance',()=>{
  const scoped=filterRelease(release,'retirement');
  const summary=buildSummary(scoped.areas[0],scoped);
  assert.equal(summary.total.value,300);
  assert.equal(summary.incomplete,false);
  assert.equal(summary.totalPerResident.value,0.3);
  assert.equal(summary.scope.id,'retirement');
});
test('ranks use selected programmes and completeness rather than the all-programme total',()=>{
  const second=area('b',[group('jobseeker',1),group('age',400),group('aged-care-home',100),group('cra',500),group('ndis',100)]);
  const scoped=filterRelease({...release,areas:[...release.areas,second]},'retirement');
  const ranking=buildRankings(scoped,'lga');
  assert.equal(ranking.rankedCount,2);
  assert.deepEqual(ranking.rows.map(r=>[r.area.name,r.total.value,r.rank]),[['b',500,1],['a',300,2]]);
});
test('scope persists in share links, document labels and download names',()=>{
  const scoped=filterRelease(release,'retirement');
  const summary=buildSummary(scoped.areas[0],scoped);
  assert.equal(readAreaLink(areaLink(summary,'https://example.com')).scope,'retirement');
  assert.match(documentContent(summary,'invoice').scopeLabel,/Retirement/);
  assert.match(exportFilename(summary,'receipt','png'),/retirement/);
  assert.equal(readAreaLink(areaLink({...summary,scope:scopeFor('all')},'https://example.com')).scope,'all');
});
test('annual aged-care clients retain their period instead of becoming June snapshot counts',()=>{
  const annual={...group('aged-care-support',100),countCoverage:'annual',allocationCountDate:'2024-25',counts:[{...group('aged-care-support').counts[0],period:'2024-25',label:'Annual clients'}]};
  const record=area('annual',[annual]);
  assert.deepEqual(allocationIssues(annual,record,release),[]);
  const summary=buildSummary(record,release);
  assert.equal(summary.total.value,100);
  assert.match(documentContent(summary,'invoice').rows[0].countLines.join(' '),/FY2024–25/);
  const wrong={...annual,allocationCountDate:'2023-24'};
  assert.ok(allocationIssues(wrong,record,release).length>0);
});
test('annual coverage cannot silently relabel a June snapshot as a financial year',()=>{
  const malformed={...group('aged-care-support'),countCoverage:'annual'};
  const record=area('bad',[malformed]);
  assert.ok(allocationIssues(malformed,record,release).length>0);
  const summary=buildSummary(record,release);
  assert.equal(summary.groups[0].counts[0].value,null);
  assert.equal(summary.groups[0].spending.value,null);
});
test('residential care is separately displayed with NDIS but additive in retirement totals',()=>{
  const input={...release,areas:[area('a',[group('age',200),group('ndis',100),{...group('aged-care-residential',50),overlapWith:'ndis'},group('cra',20)])]};
  const all=filterRelease(input,'all'),retirement=filterRelease(input,'retirement');
  assert.equal(buildSummary(all.areas[0],all).total.value,300);
  assert.equal(buildSummary(retirement.areas[0],retirement).total.value,250);
  assert.match(documentContent(buildSummary(all.areas[0],all),'invoice').footer.join(' '),/NDIS can reimburse/);
  assert.equal(input.areas[0].groups[2].additive,true);
});
test('an explicit gross inclusion policy carries aged care into totals, per-person values, ranks and exports',()=>{
  const input={...release,areas:[area('gross',[group('age',200),group('ndis',100),{...group('aged-care-residential',50),overlapWith:'ndis',overlapPolicy:'include-gross'},group('cra',20)]),area('other',[group('age',325)])]};
  const all=filterRelease(input,'all'),retirement=filterRelease(input,'retirement'),working=filterRelease(input,'working');
  const summary=buildSummary(all.areas[0],all);
  assert.equal(summary.total.value,350);
  assert.equal(summary.totalPerResident.value,0.35);
  assert.equal(buildSummary(retirement.areas[0],retirement).total.value,250);
  assert.equal(buildSummary(working.areas[0],working).total.value,100);
  assert.deepEqual(buildRankings(all,'lga').rows.map(row=>[row.area.name,row.rank]),[['gross',1],['other',2]]);
  for(const style of ['receipt','invoice']){
    const document=documentContent(summary,style);
    assert.equal(document.rows.find(row=>row.label==='aged-care-residential').nonAdditive,false);
    assert.match(document.footer.join(' '),/overlap is not deducted/);
  }
});
test('gross inclusion never turns missing aged-care expenditure into a complete ranked total',()=>{
  const care={...group('aged-care-residential',null),overlapWith:'ndis',overlapPolicy:'include-gross'};
  const input=filterRelease({...release,areas:[area('missing',[group('age',200),group('ndis',100),care,group('cra',20)])]});
  const summary=buildSummary(input.areas[0],input);
  assert.equal(summary.total.value,300);
  assert.equal(summary.incomplete,true);
  assert.equal(buildRankings(input,'lga').rankedCount,0);
  assert.equal(buildRankings(input,'lga','per-resident').rankedCount,0);
});
test('known partial care counts and spending remain visible without gaining a complete rank',()=>{
  const partial={...group('aged-care-support',null),counts:[{...group('aged-care-support').counts[0],value:null,status:'unavailable',knownSubtotal:25}],spending:{...group('aged-care-support').spending,value:null,status:'unavailable',knownSubtotal:50000}};
  const input={...release,areas:[area('partial',[group('age',100),partial])]};
  const summary=buildSummary(input.areas[0],input);
  assert.equal(summary.total.value,50100);
  assert.equal(summary.incomplete,true);
  assert.equal(buildRankings(input,'lga').rankedCount,0);
  assert.match(documentContent(summary,'invoice').rows[1].money,/Known.*50.*incomplete/);
  assert.match(documentContent(summary,'invoice').rows[1].countLines.join(' '),/25.*incomplete/);
  const invalid={...partial,spending:{...partial.spending,geographyVintage:'LGA2025'}};
  assert.equal(buildSummary(area('bad',[group('age',100),invalid]),input).total.value,100);
});
test('invalid partial care observations are rejected and never lower a displayed subtotal',()=>{
  for(const knownSubtotal of [-1,Infinity,'100']){
    const bad={...group('aged-care-support',null),spending:{...group('aged-care-support').spending,value:null,knownSubtotal},counts:[{...group('aged-care-support').counts[0],value:null,status:'unavailable',knownSubtotal}]};
    const input={...release,areas:[area('bad',[group('age',100),bad])]};
    assert.throws(()=>validateRelease(input),/partial/);
    assert.equal(buildSummary(input.areas[0],input).total.value,100);
  }
});
test('standalone scoped documents disclose programme grouping rather than recipient age bands',()=>{
  const scoped=filterRelease(release,'working');
  const footer=documentContent(buildSummary(scoped.areas[0],scoped),'receipt').footer.join(' ');
  assert.match(footer,/older people/);
  assert.match(footer,/not a count of working-age recipients/);
});
