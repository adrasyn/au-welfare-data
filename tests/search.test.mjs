import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAreas, resolveAreaUrl } from '../dist/lib/search.mjs';
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
