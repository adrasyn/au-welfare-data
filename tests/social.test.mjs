import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildSummary} from '../dist/lib/model.mjs';
import {filterRelease} from '../dist/lib/scopes.mjs';
import {areaLink,readAreaLink} from '../dist/lib/urls.mjs';
import {resolveAreaUrl} from '../dist/lib/search.mjs';
import {socialPreview,socialMeta,socialSvg,previewPage} from '../scripts/social-card.mjs';

const origin='https://auwelfaredata.wlsn.me';
const release=JSON.parse(await readFile(new URL('../dist/data/releases/2024-25-v2.json',import.meta.url)));
const summary=(id,scope='all')=>{const r=filterRelease(release,scope);return buildSummary(r.areas.find(a=>a.id===id),r);};

test('share paths pin area, release and scope and legacy query links remain readable',()=>{
  const input=summary('lga:10180','retirement'),url=areaLink(input,origin);
  assert.equal(url,origin+'/area/lga/10180/2024-25-v2/retirement/');
  assert.deepEqual(readAreaLink(url),{areaId:'lga:10180',releaseId:'2024-25-v2',scope:'retirement'});
  assert.equal(resolveAreaUrl(url,release)?.id,'lga:10180');
  assert.equal(resolveAreaUrl(url,{...release,id:'different-release'}),null);
  assert.deepEqual(readAreaLink(origin+'/?area=lga%3A10180&release=2024-25-v2&scope=working'),{areaId:'lga:10180',releaseId:'2024-25-v2',scope:'working'});
});
test('area cards use the same per-person amount and programme scope as the receipt',()=>{
  const all=socialPreview(summary('lga:10180'),origin),retirement=socialPreview(summary('lga:10180','retirement'),origin);
  assert.equal(all.amount,'$8,830');assert.equal(retirement.amount,'$3,702');
  assert.match(retirement.description,/Retirement & aged care/);
  assert.match(all.description,/FY2024–25/);
  assert.match(all.description,/residential aged care excluded/i);
  assert.match(socialSvg(all),/Armidale/);
});
test('incomplete and unavailable amounts cannot appear as a complete average or zero',()=>{
  const partial=socialPreview(summary('ced:141','retirement'),origin);
  assert.match(partial.metric,/known/i);assert.match(partial.description,/incomplete/i);
  assert.match(partial.title,/known.*incomplete/i);
  const unavailable=socialPreview({...summary('lga:10180'),totalPerResident:{value:null},perResidentAvailable:false},origin);
  assert.equal(unavailable.amount,'Unavailable');assert.match(unavailable.metric,/unavailable/i);
});
test('initial HTML exposes absolute PNG Open Graph and X metadata without JavaScript',async()=>{
  const card=socialPreview(summary('lga:10180'),origin);
  const template=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const html=previewPage(template,card);
  assert.match(html,/<meta property="og:image" content="https:\/\/auwelfaredata.wlsn.me\/area\/lga\/10180\/2024-25-v2\/all\/preview.png"/);
  assert.match(html,/<meta name="twitter:card" content="summary_large_image"/);
  assert.match(html,/og:image:width" content="1200"/);
  assert.match(html,/og:image:height" content="630"/);
  assert.match(html,/<title>Armidale.*\$8,830/);
  assert.equal((html.match(/property="og:title"/g)||[]).length,1);
  assert.equal((html.match(/name="description"/g)||[]).length,1);
  assert.match(socialMeta({...card,title:'A & "B" <C>'}),/A &amp; &quot;B&quot; &lt;C&gt;/);
});
