import { buildSummary, formatAUD, formatCount, formatSourceDate } from './lib/model.mjs';
import { searchAreas, resolveAreaUrl } from './lib/search.mjs';
import { documentContent, areaLink, exportFilename } from './lib/render.mjs';
import { previewGraphic, exportGraphic, saveBlob } from './lib/download.mjs';
import {buildRankings} from './lib/rankings.mjs';

const canonicalOrigin='https://benefits-data-australia.vvlsn.chatgpt.site';
const $=id=>document.getElementById(id);
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let release,selected,summary,style='receipt',matches=[],filter='all',previewVersion=0,exporting=false,downloadUrl;
let rankings,rankingType='ced',rankingPage=0;
const rankingPageSize=20;

function status(id,text,error=false) {$(id).textContent=text;$(id).classList.toggle('error',error);}
function buttons() {
  const disabled=!summary||exporting||(style==='receipt'&&!summary.perResidentAvailable);
  $('download-png').disabled=disabled;$('download-pdf').disabled=disabled;
  $('copy-link').disabled=!summary;$('print').disabled=disabled;
}
async function loadData(current=false) {
  status('search-status','Loading area data…');$('retry').hidden=true;
  try {
    const parameters=new URL(location.href).searchParams;
    const requested=current?null:parameters.get('release');
    if(requested&&!/^[a-z0-9-]+$/i.test(requested)) throw new Error('That data release is not available. Load current data to search.');
    const version=requested??(await (await fetch('/data/current.json')).json()).release;
    const response=await fetch(`/data/releases/${version}.json`);
    if(!response.ok) throw new Error('That data release could not be loaded. Load current data or try again.');
    release=await response.json();
    rankings={ced:buildRankings(release,'ced'),lga:buildRankings(release,'lga')};
    $('rankings-loading').hidden=true;$('rankings-content').hidden=false;
    renderRankings();
    $('financial-year').textContent=`Financial year ${release.financialYear.replace('-','–')}`;
    $('recipient-date').textContent=`Recipients at ${formatSourceDate(release.countDate)}`;
    $('spending-year').textContent=`Estimated spend in ${release.financialYear.replace('-','–')}`;
    $('area-search').disabled=false;$('search-button').disabled=false;
    status('search-status','');
    for(const key of ['allocation','counts','geography','overlap','population']) $(`method-${key}`).textContent=release.methodology[key];
    $('data-release').textContent=release.id;
    $('source-list').innerHTML=release.sources.map(s=>`<li><a href="${escape(s.url)}" target="_blank" rel="noopener">${escape(s.title)}</a></li>`).join('');
    if(current) history.replaceState(null,'',location.pathname);
    const area=resolveAreaUrl(location.href,release);
    if(area) {await selectArea(area,false);}
    else if(parameters.get('area')&&!current) status('search-status','That area is not available in this release. Search for its name or postcode.',true);
  } catch(error) {status('search-status',error.message||'Area data could not be loaded. Try again.',true);$('retry').hidden=false;$('rankings-loading').textContent='Spending rankings are unavailable until the area data loads. Use “Load current data” above to retry.';}
}
function renderMatches() {
  const results=filter==='all'?matches:matches.filter(a=>a.type===filter);
  $('results').hidden=false;
  $('result-count').textContent=`${results.length} ${results.length===1?'match':'matches'}`;
  $('area-results').innerHTML=results.slice(0,40).map(a=>`<li><button type="button" data-area="${escape(a.id)}"><span><span class="result-name">${escape(a.name)}</span><span class="result-kind">${a.type==='ced'?'Federal electorate':'Council area'} · ${escape(a.state)}</span></span><span class="result-chevron" aria-hidden="true">›</span></button></li>`).join('');
  if(!results.length) status('search-status',matches.length?'No matches in this area type. Choose All areas or try another search.':'No matching area. Try an electorate or council name. Some PO Box postcodes are not represented by ABS Postal Areas.');
  else status('search-status',results.length>40?'Showing the first 40 matches. Add a state or more of the area name to narrow the search.':`Choose ${results.length===1?'the area':'an area'} below.`);
}
function search() {
  if(!release) return;
  const query=$('area-search').value.trim();
  if(!query) {$('results').hidden=true;status('search-status','Enter a four-digit postcode or an electorate/council name.');return;}
  if(/^\d+$/.test(query)&&query.length!==4) {$('results').hidden=true;status('search-status','Enter a four-digit Australian postcode, including any leading zero.');return;}
  matches=searchAreas(query,release.areas);renderMatches();
}
async function selectArea(area,moveFocus=true,fromRanking=false) {
  clearDownload();
  selected=area;summary=buildSummary(area,release);
  $('results').hidden=true;status('search-status','');
  $('area-search').value=area.name;
  $('area-summary').hidden=false;
  $('area-name').textContent=area.name;
  $('area-type').textContent=`${area.type==='ced'?'Federal electorate':'Council area'} · ${area.state}`;
  $('area-population').textContent=summary.perResidentAvailable?`${area.population.value.toLocaleString('en-AU')} residents · ABS ${formatSourceDate(summary.populationDate)}`:'Compatible resident population unavailable. Area spending and recipient counts are shown below.';
  const ranking=rankings[area.type],row=ranking.rows.find(row=>row.area.id===area.id);
  $('total-spending-label').textContent=summary.incomplete?'Known annual spending subtotal':'Estimated total annual spending';
  $('total-spending-value').textContent=formatAUD(summary.total.value,{compact:true});
  $('total-spending-exact').textContent=`${formatAUD(summary.total.value,{roundTo:1000})} · FY${summary.financialYear.replace('-','–')}`;
  $('area-spending-rank').textContent=row.rank===null?'Unranked — incomplete spending data':`#${row.rank} of ${ranking.rankedCount} ${area.type==='ced'?'federal divisions':'LGAs'} by total spending`;
  if(rankingType!==area.type||!fromRanking)rankingPage=0;
  rankingType=area.type;renderRankings();
  $('payment-list').innerHTML=summary.groups.map(group=>`<li class="payment-row"><div class="payment-name">${escape(group.label)}<details><summary>About this payment</summary><p>${escape(group.description)}</p>${group.components?.length>1?`<ul class="component-spending">${group.components.map(c=>`<li>${escape(c.label)}: ${escape(formatAUD(c.spending.value,{roundTo:1000}))} estimated annual spend</li>`).join('')}</ul>`:''}</details></div><div class="counts">${group.counts.map(c=>`<div>${!['People','Participants'].includes(c.label)?`<span class="count-label">${escape(c.label)}</span>`:''}<strong>${escape(formatCount(c))}</strong></div>`).join('')}</div><div class="payment-money">${escape(formatAUD(group.spending.value,{compact:true}))}${group.additive===false?'<small>Not added to subtotal</small>':''}</div></li>`).join('');
  $('data-issues').hidden=!summary.issues.length;
  $('data-issues').innerHTML=summary.issues.map(issue=>`<li>${escape(issue)}</li>`).join('');
  $('subtotal-label').textContent=summary.totalLabel;
  $('subtotal-money').textContent=formatAUD(summary.total.value,{compact:true});
  $('incomplete-note').hidden=!summary.incomplete;
  $('incomplete-note').textContent='Some programme data is unavailable or suppressed. The subtotal excludes those unavailable estimates.';
  history.replaceState({area:area.id},'',new URL(areaLink(summary,location.origin)).pathname+new URL(areaLink(summary,location.origin)).search);
  $('preview-detail').textContent=area.name;
  status('download-status','');buttons();
  if(!summary.perResidentAvailable) setStyle('invoice');
  else await updatePreview();
  if(moveFocus) $('area-name').focus({preventScroll:true});
}
async function updatePreview() {
  if(!summary)return;
  const version=++previewVersion;
  buttons();
  $('empty-preview').hidden=true;$('graphic').hidden=false;
  $('preview-caption').textContent=style==='receipt'?'Annual spending per resident, with local recipient counts.':'Annual spending for the whole area, with local recipient counts.';
  $('view-document').textContent=`View and download your ${style}`;
  const content=documentContent(summary,style);
  $('document-text').hidden=false;
  $('document-text-content').innerHTML=`<h3>${escape(content.area)} — ${escape(content.title)}</h3><p>${escape(content.geography)}<br>${escape(content.period)}<br>${escape(content.countDate)}<br>${escape(content.populationDate)}</p><p><strong>${escape(content.unit)}</strong></p><ul class="document-text-rows">${content.rows.map(row=>`<li><strong>${escape(row.label)}: ${escape(row.money)}</strong><span>${row.countLines.map(escape).join('<br>')}</span>${row.nonAdditive?'<small>Not added to subtotal</small>':''}</li>`).join('')}</ul><p><strong>${escape(content.totalLabel)}: ${escape(content.total)}</strong></p>${content.footer.map(note=>`<p>${escape(note)}</p>`).join('')}<p><a href="${escape(areaLink(summary,canonicalOrigin))}">View this area and its sources</a> · Release ${escape(summary.releaseId)}</p>`;
  try {
    const canvas=await previewGraphic(summary,style,canonicalOrigin);
    if(version!==previewVersion) return;
    const image=new Image();image.src=canvas.toDataURL('image/png');
    image.alt=`${selected.name} benefits ${style}. Full figures are available in “Read this ${style} as text” below.`;
    image.setAttribute('aria-details','document-text');
    $('graphic').replaceChildren(image);
    canvas.width=1;canvas.height=1;
  } catch(error) {status('download-status','The preview could not be generated. Choose the other format or try again.',true);}
}
function setStyle(value) {
  clearDownload();
  style=value;
  $('document-text-label').textContent=`Read this ${style} as text`;
  for(const button of document.querySelectorAll('[data-style]'))button.setAttribute('aria-pressed',String(button.dataset.style===style));
  updatePreview();
}
async function download(format) {
  if(!summary||exporting)return;
  exporting=true;buttons();status('download-status',`Preparing your ${style}…`);
  const exportSummary=summary,exportStyle=style;
  try {
    const blob=await exportGraphic(exportSummary,exportStyle,format,canonicalOrigin);
    if(summary!==exportSummary||style!==exportStyle){status('download-status','The selected area or format changed. Download the current document again.');return;}
    clearDownload();
    downloadUrl=saveBlob(blob,exportFilename(exportSummary,exportStyle,format),$('save-file'));
    $('save-file').hidden=false;$('save-file').textContent=`Save ${style} ${format.toUpperCase()}`;
    status('download-status',`${format.toUpperCase()} ready. If it did not download automatically, use the save link below.`);
  } catch(error) {status('download-status',`${error.message||'The download failed.'} Your selected area is saved; try again.`,true);}
  finally {exporting=false;buttons();}
}
function clearDownload() {
  if(downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl=undefined;$('save-file').hidden=true;$('save-file').removeAttribute('href');
}
function renderRankings() {
  if(!rankings)return;
  const ranking=rankings[rankingType];
  const query=$('ranking-search').value.trim();
  const ids=query?new Set(searchAreas(query,ranking.rows.map(row=>row.area)).map(area=>area.id)):null;
  const rows=ids?ranking.rows.filter(row=>ids.has(row.area.id)):ranking.rows;
  const pages=Math.max(1,Math.ceil(rows.length/rankingPageSize));
  rankingPage=Math.min(rankingPage,pages-1);
  const start=rankingPage*rankingPageSize;
  $('ranking-area-heading').textContent=rankingType==='ced'?'Federal division':'Council area (LGA)';
  $('ranking-year').textContent=`FY${release.financialYear.replace('-','–')}`;
  $('ranking-count').textContent=`${ranking.rankedCount} of ${ranking.totalCount} ${rankingType==='ced'?'divisions':'LGAs'} ranked. ${ranking.totalCount-ranking.rankedCount?`${ranking.totalCount-ranking.rankedCount} have incomplete data and are listed as unranked.`:'All have complete estimates.'}`;
  $('ranking-results').textContent=rows.length?`Showing ${start+1}–${Math.min(start+rankingPageSize,rows.length)} of ${rows.length} areas${query?' matching your search':''}. Ranks are national within the selected area type.`:'No matching areas. Try a name, state or four-digit postcode.';
  $('ranking-rows').innerHTML=rows.slice(start,start+rankingPageSize).map(row=>`<tr${row.area.id===selected?.id?' class="selected-ranking"':''}><td class="rank-number">${row.rank===null?'Unranked':`#${row.rank}`}</td><th scope="row"><a href="${escape(areaLink({area:row.area,releaseId:release.id},canonicalOrigin))}" data-ranking-area="${escape(row.area.id)}"${row.area.id===selected?.id?' aria-current="true"':''}>${escape(row.area.name)}<span>${escape(row.area.state)}</span></a></th><td class="rank-spending"><strong>${escape(formatAUD(row.total.value,{compact:true}))}</strong><small>${row.eligible?escape(formatAUD(row.total.value,{roundTo:1000})):'Known subtotal · incomplete'}</small></td></tr>`).join('');
  $('ranking-prev').disabled=rankingPage===0;
  $('ranking-next').disabled=rankingPage>=pages-1;
  $('ranking-page').textContent=`Page ${rankingPage+1} of ${pages}`;
  for(const button of document.querySelectorAll('[data-ranking-type]'))button.setAttribute('aria-pressed',String(button.dataset.rankingType===rankingType));
}
window.addEventListener('pagehide',clearDownload);
$('search-form').addEventListener('submit',event=>{event.preventDefault();search();});
$('area-search').addEventListener('input',()=>{if(release&&$('area-search').value.trim().length>=2)search();else{$('results').hidden=true;status('search-status','');}});
for(const button of document.querySelectorAll('[data-query]'))button.addEventListener('click',()=>{$('area-search').value=button.dataset.query;search();});
for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{filter=button.dataset.filter;for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b===button));renderMatches();});
$('area-results').addEventListener('click',event=>{const button=event.target.closest('[data-area]');if(button)selectArea(release.areas.find(a=>a.id===button.dataset.area));});
$('change-area').addEventListener('click',()=>{$('area-search').focus();$('area-search').select();});
for(const button of document.querySelectorAll('[data-style]'))button.addEventListener('click',()=>setStyle(button.dataset.style));
$('download-png').addEventListener('click',()=>download('png'));
$('download-pdf').addEventListener('click',()=>download('pdf'));
$('retry').addEventListener('click',()=>loadData(true));
$('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(areaLink(summary,canonicalOrigin));status('download-status','Area link copied.');}catch{status('download-status',`Copy this link: ${areaLink(summary,canonicalOrigin)}`);}});
$('print').addEventListener('click',()=>window.print());
$('view-document').addEventListener('click',()=>{$('document-panel').scrollIntoView({behavior:'smooth',block:'start'});$('download-png').focus({preventScroll:true});});
for(const button of document.querySelectorAll('[data-ranking-type]'))button.addEventListener('click',()=>{rankingType=button.dataset.rankingType;rankingPage=0;renderRankings();});
$('ranking-search').addEventListener('input',()=>{rankingPage=0;renderRankings();});
$('ranking-prev').addEventListener('click',()=>{rankingPage--;renderRankings();});
$('ranking-next').addEventListener('click',()=>{rankingPage++;renderRankings();});
$('ranking-rows').addEventListener('click',async event=>{
  const link=event.target.closest('[data-ranking-area]');
  if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  await selectArea(release.areas.find(area=>area.id===link.dataset.rankingArea),true,true);
  $('area-summary').scrollIntoView({block:'start'});
});
for(const link of document.querySelectorAll('a[href="#method"],a[href="#sources"]'))link.addEventListener('click',()=>{$(link.getAttribute('href').slice(1)).open=true;});
loadData();
