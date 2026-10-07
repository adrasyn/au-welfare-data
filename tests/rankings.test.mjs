import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRankings} from '../dist/lib/rankings.mjs';

const area=(id,type,value,extra={})=>({id:`${type}:${id}`,type,name:id,state:'NSW',geographyVintage:`${type.toUpperCase()}2024`,groups:[{
  id:'job',label:'JobSeeker',financialYear:'2024-25',allocationCountDate:'2025-06-30',additive:true,
  spending:{value,status:value===null?'unavailable':'estimated',unit:'AUD',period:'2024-25',geographyVintage:`${type.toUpperCase()}2024`},
  counts:[{value:5,unit:'people',status:'reported',period:'2025-06-30',geographyVintage:`${type.toUpperCase()}2024`}]
}],...extra});
const release=areas=>({areas,financialYear:'2024-25',countDate:'2025-06-30'});

test('spending rankings compare electorates and councils separately, highest first',()=>{
  const data=release([area('low','ced',100),area('council','lga',3000),area('high','ced',200)]);
  assert.deepEqual(buildRankings(data,'ced').rows.map(r=>[r.area.name,r.rank]),[['high',1],['low',2]]);
  assert.equal(buildRankings(data,'lga').rows[0].rank,1);
});
test('ranking uses full precision and gives exact ties the same competition rank',()=>{
  const result=buildRankings(release([area('a','ced',100.4),area('b','ced',100.49),area('c','ced',100.49),area('d','ced',90)]),'ced');
  assert.deepEqual(result.rows.map(r=>[r.area.name,r.rank]),[['b',1],['c',1],['a',3],['d',4]]);
});
test('incomplete or incompatible totals stay visible but are not ranked as full totals',()=>{
  const partial=area('partial','lga',3000);
  partial.groups.push({...structuredClone(partial.groups[0]),id:'ndis',spending:{...partial.groups[0].spending,value:null,status:'unavailable'}});
  const incompatible=area('wrong-period','lga',5000);incompatible.groups[0].spending.period='2023-24';
  const result=buildRankings(release([partial,incompatible,area('complete','lga',100)]),'lga');
  assert.equal(result.rankedCount,1);
  assert.equal(result.totalCount,3);
  assert.deepEqual(result.rows.map(r=>r.rank),[1,null,null]);
  assert.equal(result.rows.find(r=>r.area.name==='partial').total.value,3000);
});
test('Rent Assistance does not get added again when calculating a spending rank',()=>{
  const a=area('a','ced',100);a.groups.push({...structuredClone(a.groups[0]),id:'cra',additive:false,spending:{...a.groups[0].spending,value:1000}});
  const result=buildRankings(release([a,area('b','ced',200)]),'ced');
  assert.deepEqual(result.rows.map(r=>r.area.name),['b','a']);
  assert.equal(result.rows[1].total.value,100);
});
test('published rankings cover every area and reconcile with independent source totals',async()=>{
  const data=JSON.parse(await readFile(new URL('../dist/data/releases/2024-25-v1.json',import.meta.url)));
  const ced=buildRankings(data,'ced'),lga=buildRankings(data,'lga');
  assert.equal(ced.rankedCount,150);assert.equal(lga.totalCount,547);assert.equal(lga.rankedCount,508);
  assert.equal(ced.rows[0].area.name,'Spence');assert.equal(lga.rows[0].area.name,'Brisbane');
  const sydney=ced.rows.find(r=>r.area.id==='ced:141');
  const raw=data.areas.find(a=>a.id==='ced:141').groups.filter(g=>g.additive).reduce((sum,g)=>sum+g.spending.value,0);
  assert.equal(sydney.total.value,raw);
  assert.equal(lga.rows.find(r=>r.area.id==='lga:44000').rank,null);
});
