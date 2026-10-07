import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateRelease} from '../scripts/data-utils.mjs';
import {buildSummary} from '../dist/lib/model.mjs';
import {filterRelease} from '../dist/lib/scopes.mjs';
import {buildRankings} from '../dist/lib/rankings.mjs';
const original=JSON.parse(await readFile(new URL('../dist/data/releases/2024-25-v1.json',import.meta.url)));
const data=JSON.parse(await readFile(new URL('../dist/data/releases/2024-25-v2.json',import.meta.url)));
test('the aged-care release preserves original programmes and their dated population',()=>{
  assert.equal(validateRelease(data),true);
  assert.equal(data.areas.length,697);
  for(const area of data.areas){
    const old=original.areas.find(old=>old.id===area.id);
    assert.deepEqual(area.population,old.population);
    assert.deepEqual(area.groups.slice(0,9),old.groups);
    assert.equal(area.groups.length,12);
  }
});
test('care allocation uses the audited programme-specific spending and mapped-count proxy',()=>{
  const amounts={'aged-care-residential':23965600000,'aged-care-home':8659900000,'aged-care-support':3270000000};
  for(const group of data.areas.flatMap(area=>area.groups.filter(group=>group.id.startsWith('aged-care-')))){
    assert.equal(group.allocation.nationalExpenditure,amounts[group.id]);
    assert.match(group.allocation.denominatorBasis,/mapped/);
    if(group.counts[0].value!==null)assert.ok(Math.abs(group.spending.value-amounts[group.id]*group.counts[0].value/group.allocation.denominator)<0.001);
  }
});
test('incomplete geographic care coverage cannot acquire a total or per-person rank',()=>{
  const expected={all:[139,497],working:[150,508],retirement:[133,493]};
  for(const [scope,counts] of Object.entries(expected)){
    const filtered=filterRelease(data,scope);
    for(const [index,type]of ['ced','lga'].entries()){
      assert.equal(buildRankings(filtered,type).rankedCount,counts[index]);
      assert.equal(buildRankings(filtered,type,'per-resident').rankedCount,counts[index]);
    }
  }
});
test('Sydney retains its known care subtotal without filling missing Lord Howe records',()=>{
  const scoped=filterRelease(data,'retirement');
  const result=buildSummary(scoped.areas.find(area=>area.id==='ced:141'),scoped);
  assert.equal(result.incomplete,true);
  for(const id of ['aged-care-residential','aged-care-support']){
    const group=result.groups.find(group=>group.id===id);
    assert.equal(group.counts[0].value,null);
    assert.ok(group.counts[0].knownSubtotal>0);
    assert.equal(group.spending.value,null);
    assert.ok(group.spending.knownSubtotal>0);
  }
  const support=result.groups.find(group=>group.id==='aged-care-support');
  assert.equal(support.countCoverage,'annual');
  assert.equal(support.counts[0].period,'2024-25');
});
