import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAreas, resolveAreaUrl } from '../dist/lib/search.mjs';
import * as searchModel from '../dist/lib/search.mjs';
const areas=[
  {id:'ced:a',name:'Central',state:'NSW',type:'ced',postcodes:['2000']},
  {id:'lga:b',name:'Central',state:'VIC',type:'lga',postcodes:['2000','0800']},
  {id:'ced:c',name:'Macarthur',state:'NSW',type:'ced',postcodes:['2560']}
];
test('postcode retains every intersecting electorate and council choice',()=>{
  assert.deepEqual(searchAreas('2000',areas)?.map(a=>a.id),['ced:a','lga:b']);
});
test('leading zero postcodes are preserved',()=>{
  assert.deepEqual(searchAreas('0800',areas)?.map(a=>a.id),['lga:b']);
});
test('area names are case insensitive and ignore surrounding whitespace',()=>{
  assert.deepEqual(searchAreas(' CENTRAL ',areas)?.map(a=>a.id),['ced:a','lga:b']);
});
test('invalid or empty queries do not return the entire country',()=>{
  assert.deepEqual(searchAreas('',areas),[]);
  assert.deepEqual(searchAreas('200',areas),[]);
});
test('state-qualified duplicate area names remain distinguishable',()=>{
  assert.deepEqual(searchAreas('Central VIC',areas)?.map(a=>a.id),['lga:b']);
});
test('URLs pin the exact area and release, never a different snapshot',()=>{
  assert.equal(resolveAreaUrl('https://example.com/?area=ced:a&release=old',{id:'new',areas}),null);
  assert.equal(resolveAreaUrl('https://example.com/?area=ced:a&release=new',{id:'new',areas})?.id,'ced:a');
});
test('partial postcodes offer labelled postcode choices without pretending they are area totals',()=>{
  const results=searchModel.searchSuggestions?.('20',areas,['2000','2007','0800']);
  assert.deepEqual(results?.map(r=>[r.id,r.type,r.name]),[['postcode:2000','postcode','2000'],['postcode:2007','postcode','2007']]);
});
test('postcode suggestions preserve leading zeros',()=>{
  assert.deepEqual(searchModel.searchSuggestions?.('08',areas,['0800','0801','2000'])?.map(r=>r.name),['0800','0801']);
});
test('a complete postcode offers all matching divisions and LGAs with postcode context',()=>{
  const results=searchModel.searchSuggestions?.('2000',areas,['2000']);
  assert.deepEqual(results?.map(r=>[r.id,r.type,r.postcode]),[['ced:a','ced','2000'],['lga:b','lga','2000']]);
});
test('division and LGA labels are accepted when searching names',()=>{
  assert.deepEqual(searchAreas('Central division',areas).map(a=>a.id),['ced:a']);
  assert.deepEqual(searchAreas('Central LGA',areas).map(a=>a.id),['lga:b']);
});
test('short, invalid or unknown input does not show unrelated suggestions',()=>{
  for(const q of ['','2','20000','xyz-no-area'])assert.deepEqual(searchModel.searchSuggestions?.(q,areas,['2000']),[]);
});
test('short name prefixes do not match every area through its type label',()=>{
  const records=[...areas,{id:'lga:d',name:'Diamantina',state:'QLD',type:'lga',postcodes:['4482']},{id:'ced:e',name:'Cowper',state:'NSW',type:'ced',postcodes:['2450']}];
  assert.deepEqual(searchAreas('Di',records).map(a=>a.id),['lga:d']);
  assert.deepEqual(searchAreas('Co',records).map(a=>a.id),['ced:e']);
});
