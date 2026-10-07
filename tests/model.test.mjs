import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSummary, formatCount, formatAUD } from '../dist/lib/model.mjs';
const count=(value,unit='people',label='People')=>({value,unit,label,status:'reported',period:'2025-06-30',geographyVintage:'LGA2024'});
const group=(id,value,extra={})=>({id,label:id,counts:[count(10)],spending:{value,status:'estimated',unit:'AUD',period:'2024-25',geographyVintage:'LGA2024'},financialYear:'2024-25',allocationCountDate:'2025-06-30',additive:true,...extra});
const area=groups=>({id:'lga:test',name:'Test',type:'lga',geographyVintage:'LGA2024',population:{value:100,status:'reported',geographyVintage:'LGA2024',period:'2024-06-30'},groups});

test('totals use unrounded monetary values before display rounding',()=>{
  const result=buildSummary(area([group('a',100.4),group('b',200.4)]));
  assert.equal(result?.total?.value,300.8);
  assert.equal(result?.totalPerResident?.value,3.008);
});
test('Rent Assistance is visible but not added to embedded primary expenditure',()=>{
  const result=buildSummary(area([group('job',1000),group('cra',200,{additive:false,overlapHandled:true})]));
  assert.equal(result?.total?.value,1000);
  assert.equal(result?.groups?.length,2);
  assert.match(result?.totalLabel??'',/subtotal/i);
});
test('FTB A and B remain distinct family counts in the summary',()=>{
  const result=buildSummary(area([group('ftb',1000,{counts:[count(100,'families','Part A'),count(80,'families','Part B')]})]));
  assert.deepEqual(result?.groups?.[0]?.counts?.map(c=>c.value),[100,80]);
  assert.equal(Object.hasOwn(result??{},'totalPeople'),false);
});
test('a missing payment yields an explicitly incomplete subtotal',()=>{
  const result=buildSummary(area([group('job',1000),group('ndis',null)]));
  assert.equal(result?.total?.value,1000);
  assert.equal(result?.incomplete,true);
});
test('mixed financial years never produce a combined money figure',()=>{
  const result=buildSummary(area([group('job',1000),group('ndis',500,{financialYear:'2023-24'})]));
  assert.equal(result?.total?.value,null);
});
test('a mismatched population boundary disables per-resident calculations',()=>{
  const record=area([group('job',1000)]);record.population.geographyVintage='LGA2025';
  const result=buildSummary(record);
  assert.equal(result?.perResidentAvailable,false);
  assert.equal(result?.groups?.[0]?.perResident?.value,null);
  assert.equal(result?.total?.value,1000);
});
test('zero population disables a receipt without dividing by zero',()=>{
  const record=area([group('job',1000)]);record.population.value=0;
  assert.equal(buildSummary(record)?.perResidentAvailable,false);
});
test('suppressed bounds and units survive count formatting',()=>{
  assert.match(formatCount({value:null,status:'suppressed',displayBound:'<11',unit:'participants'})??'',/<11.*participants/);
});
test('geographically allocated counts display as estimates',()=>{
  assert.match(formatCount({value:99.7,status:'estimated',unit:'participants'})??'',/≈.*100.*participants/);
});
test('true zero is displayed, while a missing value is unavailable',()=>{
  assert.equal(formatAUD(0),'$0');
  assert.equal(formatAUD(null),'Unavailable');
});
test('billion-dollar area totals use readable billion units in compact displays',()=>{
  assert.equal(formatAUD(6363265382.837656,{compact:true}),'$6.4b');
});
test('count geography mismatch withholds that payment estimate and explains it',()=>{
  const payment=group('ndis',500);payment.counts[0].geographyVintage='LGA2025';
  const result=buildSummary(area([group('job',1000),payment]));
  assert.equal(result.groups[1].spending.value,null);
  assert.equal(result.groups[1].counts[0].value,null);
  assert.match(result.issues?.join(' ')??'',/geograph/i);
  assert.equal(result.total.value,1000);
});
test('spending period is checked independently of the group year',()=>{
  const payment=group('ndis',500);payment.spending.period='2023-24';
  const result=buildSummary(area([group('job',1000),payment]));
  assert.equal(result.groups[1].spending.value,null);
  assert.match(result.issues?.join(' ')??'',/period|year/i);
});
test('a count-date mismatch prevents using an incompatible allocation numerator',()=>{
  const payment=group('ndis',500);payment.counts[0].period='2025-03-31';
  const result=buildSummary(area([payment]));
  assert.equal(result.groups[0].spending.value,null);
  assert.match(result.issues?.join(' ')??'',/date|snapshot/i);
});
