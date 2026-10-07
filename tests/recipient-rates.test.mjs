import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as model from '../dist/lib/model.mjs';
import {buildRankings} from '../dist/lib/rankings.mjs';
import {documentContent} from '../dist/lib/render.mjs';

const count=(value,unit='people',label='People')=>({value,unit,label,status:value===null?'suppressed':'reported',period:'2025-06-30',geographyVintage:'LGA2024'});
const group=(id,counts,amount=1000)=>({id,label:id,counts,financialYear:'2024-25',allocationCountDate:'2025-06-30',additive:true,spending:{value:amount,status:'estimated',unit:'AUD',period:'2024-25',geographyVintage:'LGA2024'}});
const area=(id,population,groups)=>({id:`lga:${id}`,name:id,state:'NSW',type:'lga',geographyVintage:'LGA2024',population:{value:population,period:'2024-06-30',geographyVintage:'LGA2024'},groups});
const release=areas=>({id:'test',areas,financialYear:'2024-25',countDate:'2025-06-30',populationDate:'2024-06-30'});

test('individual and participant counts become percentages of the resident population',()=>{
  const result=model.buildSummary(area('a',1000,[group('jobseeker',[count(50)]),group('ndis',[count(30,'participants','Participants')])]));
  assert.equal(result.groups[0].counts[0].rate?.value,5);
  assert.equal(result.groups[1].counts[0].rate?.value,3);
  assert.equal(result.groups[0].counts[0].rate?.unit,'percent');
});
test('families and income units are rates per 1000 residents, never people percentages',()=>{
  const result=model.buildSummary(area('a',1000,[group('ftb',[count(100,'families','Part A'),count(80,'families','Part B')]),group('cra',[count(50,'income-units','Recipient households')])]));
  const a=result.recipientMeasures?.find(m=>m.id==='ftb-a'),b=result.recipientMeasures?.find(m=>m.id==='ftb-b');
  assert.equal(a?.rate.value,100);assert.equal(b?.rate.value,80);
  assert.equal(a?.rate.unit,'families-per-1000');
  assert.equal(result.recipientMeasures?.find(m=>m.id==='cra')?.rate.unit,'income-units-per-1000');
  assert.equal(result.recipientMeasures?.some(m=>m.id==='ftb'),false);
});
test('Youth Allowance and Parenting Payment combine only disjoint individual categories',()=>{
  const result=model.buildSummary(area('a',1000,[group('youth',[count(20,'people','Job seekers'),count(30,'people','Students & apprentices')]),group('parenting',[count(10,'people','Single'),count(5,'people','Partnered')])]));
  assert.equal(result.recipientMeasures?.find(m=>m.id==='youth')?.rate.value,5);
  assert.equal(result.recipientMeasures?.find(m=>m.id==='parenting')?.rate.value,1.5);
});
test('zero or incompatible population and suppressed counts cannot become ranked rates',()=>{
  const zero=area('zero',0,[group('jobseeker',[count(10)])]);
  const wrong=area('wrong',1000,[group('jobseeker',[count(10)])]);wrong.population.geographyVintage='LGA2025';
  const suppressed=area('suppressed',1000,[group('jobseeker',[count(null)])]);
  const result=buildRankings(release([zero,wrong,suppressed,area('valid',1000,[group('jobseeker',[count(0)])])]),'lga','jobseeker');
  assert.equal(result.rankedCount,1);
  assert.equal(result.rows[0].area.name,'valid');
  assert.equal(result.rows[0].rate?.value,0);
  assert.deepEqual(result.rows.map(r=>r.rank),[1,null,null,null]);
});
test('rate rankings use population shares rather than recipient counts or money',()=>{
  const result=buildRankings(release([area('large',10000,[group('jobseeker',[count(500)],9000)]),area('small',1000,[group('jobseeker',[count(100)],1000)])]),'lga','jobseeker');
  assert.deepEqual(result.rows.map(r=>r.area.name),['small','large']);
  assert.deepEqual(result.rows.map(r=>r.rate?.value),[10,5]);
});
test('population dates must match the release denominator date for comparable rates',()=>{
  const record=area('a',1000,[group('jobseeker',[count(50)])]);record.population.period='2023-06-30';
  const result=buildRankings(release([record]),'lga','jobseeker');
  assert.equal(result.rankedCount,0);
  assert.equal(result.rows[0].rate?.value,null);
});
test('only the selected payment must be complete for its recipient-rate rank',()=>{
  const result=buildRankings(release([area('a',1000,[group('jobseeker',[count(50)]),group('ndis',[count(null,'participants')],null)])]),'lga','jobseeker');
  assert.equal(result.rankedCount,1);
  assert.equal(result.rows[0].rate?.value,5);
});
test('recipient-rate ranking preserves full precision and exact competition ties',()=>{
  const result=buildRankings(release([area('a',10000,[group('jobseeker',[count(104)])]),area('b',10000,[group('jobseeker',[count(105)])]),area('c',20000,[group('jobseeker',[count(210)])])]),'lga','jobseeker');
  assert.deepEqual(result.rows.map(r=>[r.area.name,r.rank]),[['b',1],['c',1],['a',3]]);
});
test('invoice carries recipient rates and both document styles retain population context',()=>{
  const summary=model.buildSummary(area('a',1000,[group('jobseeker',[count(50)])]));
  for(const style of ['receipt','invoice']){
    const content=documentContent(summary,style);
    assert.match(content.populationDate,/1,000 residents.*June 2024/);
    if(style==='invoice')assert.ok(content.rows[0].rateLines.some(line=>line.includes('5.0% of residents')));
    else assert.deepEqual(content.rows[0].rateLines,[]);
  }
});
test('combined Youth Allowance and Parenting rates appear in the detailed invoice',()=>{
  const summary=model.buildSummary(area('a',1000,[group('youth',[count(20),count(30)]),group('parenting',[count(10),count(5)])]));
    const content=documentContent(summary,'invoice');
    assert.equal(content.rows[0].combinedRate,'Combined: 5.0% of residents');
    assert.equal(content.rows[1].combinedRate,'Combined: 1.5% of residents');
});
test('source-based Sydney recipient shares use its dated ABS population and preserve FTB counts',async()=>{
  const data=JSON.parse(await readFile(new URL('../dist/data/releases/2024-25-v1.json',import.meta.url)));
  const result=model.buildSummary(data.areas.find(a=>a.id==='ced:141'),data);
  assert.equal(result.area.population.value,237426);
  assert.ok(Math.abs(result.recipientMeasures?.find(m=>m.id==='jobseeker')?.rate.value-2.4007480225417606)<0.000001);
  assert.deepEqual(result.groups.find(g=>g.id==='ftb').counts.map(c=>c.value),[2930,2415]);
});
test('small positive recipient rates are not displayed as a false zero',()=>{
  assert.equal(model.formatRecipientRate({value:0.02,unit:'percent'}),'<0.1% of residents');
  assert.equal(model.formatRecipientRate({value:0,unit:'percent'}),'0.0% of residents');
});
