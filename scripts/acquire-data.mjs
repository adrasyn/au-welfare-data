import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const cache = new URL('../.cache/sources/', import.meta.url);
await mkdir(cache, {recursive:true});
const entries=[];
async function acquire(id,url,filename) {
  const path = new URL(filename,cache);
  let bytes;
  try { bytes = await readFile(path); }
  catch {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(new URL(`${filename}.tmp`,cache),bytes);
    await rename(new URL(`${filename}.tmp`,cache),path);
  }
  entries.push({id,url,filename,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  console.log(`${id}: ${(bytes.length/1024/1024).toFixed(1)} MB`);
  return bytes;
}

for (const [id,slug] of [['dss-lga','dss-payments-by-local-government-area'],['dss-ced','dss-payments-by-commonwealth-electoral-division'],['dss-demographic','dss-payment-demographic-data']]) {
  const metadata = JSON.parse(await acquire(`${id}-metadata`, `https://data.gov.au/data/api/3/action/package_show?id=${slug}`, `${id}-metadata.json`));
  if (!metadata.success) throw new Error(`CKAN package ${slug} unavailable`);
  const resource = metadata.result.resources.find(r=>id==='dss-demographic' ? /June 2025/i.test(r.name) : /2024.*June 2026/i.test(r.name));
  if (!resource) throw new Error(`Required source not found for ${id}`);
  await acquire(id,resource.url,`${id}.${id==='dss-demographic'?'xlsx':'csv'}`);
}

async function link(page,label) {
  const response = await fetch(page);
  if (!response.ok) throw new Error(`Source index ${response.status}`);
  const html=await response.text();
  const anchors=[...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const anchor=anchors.find(a=>a[2].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().includes(label));
  if(!anchor) throw new Error(`Missing NDIS download: ${label}`);
  return new URL(anchor[1].replaceAll('&amp;','&'),page).href;
}
const participantPage='https://dataresearch.ndis.gov.au/datasets/participant-datasets';
for(const [id,label] of [['ndis-lga','Participants by LGA data'],['ndis-ced','Participants by CED data']]) {
  await acquire(id,await link(participantPage,label),`${id}.csv`);
}
const absBase='https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/';
for(const name of ['POA_2021_AUST','CED_2024_AUST','LGA_2024_AUST']) {
  await acquire(name,`${absBase}allocation-files/${name}.xlsx`,`${name}.xlsx`);
}
await acquire('abs-population','https://www.abs.gov.au/statistics/people/population/regional-population/2023-24/32180DS0004_2001-24.xlsx','abs-population.xlsx');
for(const name of ['CG_LGA_2020_LGA_2021','CG_LGA_2021_LGA_2022','CG_2022_LGA_2023_LGA','CG_LGA_2023_LGA_2024']) {
  await acquire(name,`${absBase}correspondences/${name}.csv`,`${name}.csv`);
}
await mkdir(new URL('../data/',import.meta.url),{recursive:true});
await writeFile(new URL('../data/source-manifest.json',import.meta.url),JSON.stringify({acquiredAt:new Date().toISOString(),entries},null,2));
