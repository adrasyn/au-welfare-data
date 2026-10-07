import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRelease, parseCount, allocateCounts } from '../scripts/data-utils.mjs';

test('duplicate area identifiers are rejected', () => {
  assert.throws(() => validateRelease({ areas: [{id:'lga:1'}, {id:'lga:1'}] }), /duplicate/i);
});
test('suppressed participant counts retain the published bound', () => {
  assert.deepEqual(parseCount('<11', 'participants'), { value:null, status:'suppressed', displayBound:'<11', unit:'participants' });
});
test('missing observations are not confused with a true zero', () => {
  assert.equal(parseCount('', 'people').status, 'unavailable');
  assert.equal(parseCount('0', 'people').value, 0);
});
test('population-weighted ABS correspondences conserve numeric counts', () => {
  const result = allocateCounts([{code:'a', count:parseCount('100', 'participants')}], [
    {from:'a',to:'b',ratio:0.25},{from:'a',to:'c',ratio:0.75}
  ]);
  assert.equal(result.get('b').value,25);
  assert.equal(result.get('c').value,75);
  assert.equal(result.get('b').status,'estimated');
});
test('a suppressed component prevents an exact allocated target count', () => {
  const result = allocateCounts([{code:'a', count:parseCount('<11', 'participants')}, {code:'b',count:parseCount('100','participants')}], [
    {from:'a',to:'c',ratio:1},{from:'b',to:'c',ratio:1}
  ]);
  assert.equal(result.get('c').value,null);
  assert.equal(result.get('c').status,'suppressed');
});
