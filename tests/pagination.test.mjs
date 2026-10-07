import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceSlices} from '../dist/lib/pagination.mjs';
test('long invoices split at safe row boundaries while preserving every pixel',()=>{
  assert.deepEqual(invoiceSlices(3000,1600,[500,1000,1500,2000,2500]),[{start:0,height:1500},{start:1500,height:1500}]);
  assert.deepEqual(invoiceSlices(1200,1600,[500,1000]),[{start:0,height:1200}]);
});
test('invoice pagination makes progress when a single block exceeds a page',()=>{
  assert.deepEqual(invoiceSlices(3300,1600,[]),[{start:0,height:1600},{start:1600,height:1600},{start:3200,height:100}]);
  assert.throws(()=>invoiceSlices(100,0),/dimensions/);
});
