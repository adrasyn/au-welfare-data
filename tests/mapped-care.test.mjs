import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMappedCareRelease} from '../scripts/allocate-mapped-aged-care.mjs';
import {buildSummary} from '../dist/lib/model.mjs';
import {buildRankings} from '../dist/lib/rankings.mjs';
import {filterRelease} from '../dist/lib/scopes.mjs';
import {documentContent} from '../dist/lib/render.mjs';
import {socialPreview} from '../scripts/social-card.mjs';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url)));
const old=await read('dist/data/releases/2024-25-v3.json');
const audit=await read('data/aged-care-ranking-audit-2025.json');
const manifest=await read('data/aged-care-source-manifest.json');
test('the published v4 data is exactly reproducible from its audited frozen inputs',async()=>{
  assert.deepEqual(await read('dist/data/releases/2024-25-v4.json'),createMappedCareRelease(old,audit,manifest));
});
test('mapped-care allocation restores spending ranks without changing observations or existing totals',()=>{
  const data=createMappedCareRelease(old,audit,manifest);
  assert.equal(data.id,'2024-25-v4');
  const expected={all:[150,491],working:[150,508],retirement:[150,512]};
  for(const [scope,counts] of Object.entries(expected)){
    const scoped=filterRelease(data,scope);
    for(const [index,type] of ['ced','lga'].entries()){
      assert.equal(buildRankings(scoped,type).rankedCount,counts[index]);
      assert.equal(buildRankings(scoped,type,'per-resident').rankedCount,counts[index]);
    }
  }
  for(const area of data.areas){
    const previous=old.areas.find(a=>a.id===area.id);
    assert.deepEqual(area.population,previous.population);
    assert.deepEqual(area.groups.slice(0,9),previous.groups.slice(0,9));
    for(const group of area.groups.filter(g=>g.id.startsWith('aged-care-'))){
      const source=previous.groups.find(g=>g.id===group.id);
      assert.deepEqual(group.counts,source.counts);
      assert.equal(group.spending.value,source.spending.value??source.spending.knownSubtotal??null);
    }
    assert.equal(buildSummary(area,data).total.value,buildSummary(previous,old).total.value);
  }
  assert.equal(buildRankings(filterRelease(old),'ced').rankedCount,133);
});
test('Sydney gets a modelled spending rank while its missing care counts and rates remain unavailable',()=>{
  const release=filterRelease(createMappedCareRelease(old,audit,manifest));
  const summary=buildSummary(release.areas.find(a=>a.id==='ced:141'),release);
  assert.equal(summary.incomplete,false);
  assert.equal(summary.modelledCareWithIncompleteCounts,true);
  assert.ok(Math.abs(summary.totalPerResident.value-3695.1519645041476)<0.000001);
  assert.equal(buildRankings(release,'ced','per-resident').rows.find(r=>r.area.id==='ced:141').rank,147);
  for(const id of ['aged-care-residential','aged-care-support']){
    assert.equal(summary.groups.find(g=>g.id===id).counts[0].value,null);
    assert.equal(buildRankings(release,'ced',id).rows.find(r=>r.area.id==='ced:141').rank,null);
  }
  for(const style of ['receipt','invoice']){
    const content=documentContent(summary,style);
    assert.match((style==='receipt'?content.receiptNotes:content.footer).join(' '),/counts.*incomplete/i);
    assert.match((style==='receipt'?content.receiptNotes:content.footer).join(' '),/modelled|allocation/i);
  }
  const card=socialPreview(summary,'https://example.com');
  assert.equal(card.amount,'$3,695');
  assert.match(card.metric,/estimated/i);
  assert.match(card.description,/counts.*incomplete/i);
});
test('source suppression, mismatched control totals and altered source hashes cannot qualify an allocation',()=>{
  for(const mutate of [
    a=>{a.programmes['aged-care-residential'].tables[0].nonNumericTotalCells=1;},
    a=>{a.programmes['aged-care-home'].tables[1].numericTotal++;},
    a=>{a.programmes['aged-care-support'].sha256='incorrect';}
  ]){
    const invalid=structuredClone(audit);mutate(invalid);
    assert.throws(()=>createMappedCareRelease(old,invalid,manifest),/audit|source|control/i);
  }
});
test('a suppressed count is never promoted from a known subtotal',()=>{
  const invalid=structuredClone(old);
  invalid.areas.find(a=>a.id==='ced:141').groups.find(g=>g.id==='aged-care-residential').counts[0].status='suppressed';
  assert.throws(()=>createMappedCareRelease(invalid,audit,manifest),/suppressed|provenance/i);
});
test('unavailable primary payments still prevent a total spending rank',()=>{
  const release=createMappedCareRelease(old,audit,manifest);
  const area=release.areas.find(a=>a.id==='ced:141');
  const dsp=area.groups.find(g=>g.id==='dsp');
  dsp.spending={...dsp.spending,value:null,status:'unavailable',knownSubtotal:dsp.spending.value};
  assert.equal(buildSummary(area,release).incomplete,true);
  assert.equal(buildRankings(filterRelease(release),'ced').rows.find(r=>r.area.id===area.id).rank,null);
});
test('bad partial allocation arithmetic cannot become a spending estimate',()=>{
  const invalid=structuredClone(old);
  invalid.areas.find(a=>a.id==='ced:141').groups.find(g=>g.id==='aged-care-residential').spending.knownSubtotal++;
  assert.throws(()=>createMappedCareRelease(invalid,audit,manifest),/allocation|reconcile/i);
});
