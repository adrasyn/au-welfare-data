import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRelease } from '../scripts/data-utils.mjs';
const release=JSON.parse(await readFile(new URL('../dist/data/releases/2024-25-v1.json',import.meta.url)));
test('the frozen snapshot passes observation validation',()=>assert.equal(validateRelease(release),true));
test('Sydney electorate counts match independently checked DSS June2025 cells',()=>{
  const area=release.areas.find(a=>a.id==='ced:141');
  assert.equal(area.groups.find(g=>g.id==='jobseeker').counts[0].value,5700);
  assert.equal(area.groups.find(g=>g.id==='dsp').counts[0].value,5180);
  assert.deepEqual(area.groups.find(g=>g.id==='ftb').counts.map(c=>c.value),[2930,2415]);
});
test('regional council counts match independently checked source cells',()=>{
  const area=release.areas.find(a=>a.id==='lga:10180');
  assert.equal(area.groups.find(g=>g.id==='jobseeker').counts[0].value,1505);
  assert.equal(area.groups.find(g=>g.id==='dsp').counts[0].value,1380);
  assert.equal(area.groups.find(g=>g.id==='age').counts[0].value,2980);
  assert.equal(area.groups.find(g=>g.id==='carer').counts[0].value,420);
});
