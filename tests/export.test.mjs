import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSummary } from '../dist/lib/model.mjs';
import { documentContent, exportFilename, areaLink } from '../dist/lib/render.mjs';
const summary=buildSummary({id:'ced:101',name:'Banks',state:'NSW',type:'ced',geographyVintage:'CED2024',population:{value:1000,period:'2024-06-30',geographyVintage:'CED2024'},groups:[
  {id:'ftb',label:'Family Tax Benefit',short:'Family Tax Benefit',financialYear:'2024-25',additive:true,spending:{value:1234567,status:'estimated'},counts:[
    {label:'Part A',value:100,status:'reported',unit:'families'},
    {label:'Part B',value:80,status:'reported',unit:'families'}
  ]},
  {id:'cra',label:'Rent Assistance',financialYear:'2024-25',additive:false,spending:{value:10000,status:'estimated'},counts:[{label:'Recipient households',value:20,status:'reported',unit:'income-units'}]}
]},{id:'2024-25-v1',countDate:'2025-06-30'});
test('both document styles preserve every source count and its unit',()=>{
  for(const style of ['receipt','invoice']) {
    const content=documentContent(summary,style);
    assert.deepEqual(content?.rows?.[0]?.countLines,['Part A: 100 families','Part B: 80 families']);
    assert.deepEqual(content?.rows?.[1]?.countLines,['Recipient households: 20 income units']);
  }
});
test('receipt is per resident while invoice uses the same annual amount',()=>{
  assert.equal(documentContent(summary,'receipt')?.rows?.[0]?.money,'$1,235');
  assert.equal(documentContent(summary,'invoice')?.rows?.[0]?.money,'$1,235,000');
});
test('non-additive rent assistance and estimate notes survive the export',()=>{
  assert.equal(documentContent(summary,'receipt')?.rows?.[1]?.nonAdditive,true);
  assert.match(documentContent(summary,'invoice')?.footer?.join(' ')??'',/not added/i);
});
test('QR area links pin both stable identity and data release',()=>{
  assert.equal(areaLink(summary,'https://example.com'), 'https://example.com/?area=ced%3A101&release=2024-25-v1');
});
test('download names include area geography, name, style and release',()=>{
  assert.equal(exportFilename(summary,'invoice','pdf'),'benefits-ced-banks-invoice-2024-25-v1.pdf');
});
