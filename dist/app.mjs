import { buildSummary, formatAUD, formatCount, formatSourceDate, formatRecipientRate, recipientMetrics } from './lib/model.mjs';
import { searchAreas, searchSuggestions, resolveAreaUrl } from './lib/search.mjs';
import { documentContent, areaLink, exportFilename } from './lib/render.mjs';
import { previewGraphic, exportGraphic, saveBlob } from './lib/download.mjs';
import {buildRankings} from './lib/rankings.mjs';

const canonicalOrigin='https://benefits-data-australia.vvlsn.chatgpt.site';
const $=id=>document.getElementById(id);
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let release,selected,summary,style='receipt',matches=[],previewVersion=0,exporting=false,downloadUrl;
let postcodes=[],activeSuggestion=-1;
let rankings,rankingType='ced',rankingPage=0;
let rankingMetric='spending';
const additionalRankings=new Map();
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
    postcodes=[...new Set(release.areas.flatMap(area=>area.postcodes))].sort();
    rankings={ced:buildRankings(release,'ced'),lga:buildRankings(release,'lga')};
    additionalRankings.clear();
    $('ranking-metric').innerHTML='<option value="spending">Total annual spending</option><option value="per-resident">Annual spending per person</option>'+[['people','Percentage of residents'],['families','Families / income units per 1,000 residents']].map(([unit,label])=>`<optgroup label="${label}">${recipientMetrics.filter(metric=>unit==='people'?['people','participants'].includes(metric.unit):['families','income-units'].includes(metric.unit)).map(metric=>`<option value="${metric.id}">${escape(metric.label)}</option>`).join('')}</optgroup>`).join('');
    $('ranking-metric').value=rankingMetric;
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
function closeSuggestions() {
  const wasOpen=!$('results').hidden;
  $('results').hidden=true;$('area-search').setAttribute('aria-expanded','false');
  $('area-search').removeAttribute('aria-activedescendant');activeSuggestion=-1;
  $('search-status').classList.remove('visually-hidden');if(wasOpen)status('search-status','');
}
function positionSuggestions(ensureVisible=false) {
  if($('results').hidden)return;
  const viewport=window.visualViewport;
  const viewportBottom=(viewport?.offsetTop??0)+(viewport?.height??window.innerHeight);
  let space=viewportBottom-$('search-control').getBoundingClientRect().bottom-8;
  if(ensureVisible&&document.activeElement===$('area-search')&&space<140){
    $('search-control').scrollIntoView({block:'start',behavior:'instant'});
    space=viewportBottom-$('search-control').getBoundingClientRect().bottom-8;
  }
  $('results').style.maxHeight=`${Math.max(96,Math.min(320,space))}px`;
}
function renderMatches(query,message='') {
  activeSuggestion=-1;$('area-search').removeAttribute('aria-activedescendant');
  $('results').hidden=false;$('area-search').setAttribute('aria-expanded','true');
  $('results-heading').textContent=/^\d{4}$/.test(query)?`Areas for postcode ${query}`:/^\d{2,3}$/.test(query)?'Postcode suggestions':'Matching areas';
  $('result-count').textContent=`${matches.length} ${matches.length===1?'match':'matches'}`;
  $('area-results').innerHTML=matches.slice(0,40).map((a,i)=>`<li id="search-option-${i}" role="option" aria-selected="false" data-search-index="${i}"><span class="result-copy"><span class="result-name">${escape(a.name)}</span><span class="result-kind">${a.type==='postcode'?'Choose to see divisions and LGAs':`${escape(a.state)}${a.postcode?` · Postcode ${escape(a.postcode)}`:''}`}</span></span><span class="result-badge">${a.type==='postcode'?'Postcode':a.type==='ced'?'Division':'LGA'}</span></li>`).join('');
  const note=message||(!matches.length?'No matches. Try a division or LGA name; PO Box-only postcodes may not be represented.':matches.length>40?'Showing the first 40 matches. Keep typing to narrow the results.':'');
  $('results-message').hidden=!note;$('results-message').textContent=note;
  status('search-status',note||`${matches.length} suggestions available. Use the arrow keys or select a result.`);
  $('search-status').classList.add('visually-hidden');positionSuggestions(true);
}
function search() {
  if(!release) return;
  const query=$('area-search').value.trim();
  matches=searchSuggestions(query,release.areas,postcodes);
  const message=query.length<2?'Enter at least two characters to search.':/^\d{5,}$/.test(query)?'Use a four-digit Australian postcode, including any leading zero.':'';
  renderMatches(query,message);
}
function highlightSuggestion(index) {
  const options=[...$('area-results').children];
  if(!options.length)return;
  activeSuggestion=Math.max(0,Math.min(index,options.length-1));
  options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===activeSuggestion)));
  $('area-search').setAttribute('aria-activedescendant',options[activeSuggestion].id);
  options[activeSuggestion].scrollIntoView({block:'nearest',behavior:'instant'});
}
async function chooseSuggestion(index) {
  const result=matches[index];if(!result)return;
  if(result.type==='postcode'){$('area-search').value=result.name;$('area-search').focus();search();return;}
  $('area-search').blur();
  await selectArea(release.areas.find(area=>area.id===result.id));
}
async function selectArea(area,moveFocus=true,fromRanking=false) {
  clearDownload();
  selected=area;summary=buildSummary(area,release);
  closeSuggestions();
  $('area-search').value=area.name;
  $('area-summary').hidden=false;
  $('area-name').textContent=area.name;
  $('area-type').textContent=`${area.type==='ced'?'Federal electorate':'Council area'} · ${area.state}`;
  $('area-population').textContent=summary.perResidentAvailable?`${area.population.value.toLocaleString('en-AU')} residents · ABS ${formatSourceDate(summary.populationDate)}`:'Compatible resident population unavailable. Area spending and recipient counts are shown below.';
  $('recipient-rate-context').textContent=`Recipient rates: ${formatSourceDate(summary.countDate)} counts ÷ ${formatSourceDate(summary.populationDate)} resident population. Percentages use all residents, including children, and are approximate.`;
  const ranking=rankings[area.type],row=ranking.rows.find(row=>row.area.id===area.id);
  $('total-spending-label').textContent=summary.incomplete?'Known annual spending subtotal':'Estimated total annual spending';
  $('total-spending-value').textContent=formatAUD(summary.total.value,{compact:true});
  $('total-spending-exact').textContent=`${formatAUD(summary.total.value,{roundTo:1000})} · FY${summary.financialYear.replace('-','–')}`;
  $('area-spending-rank').textContent=row.rank===null?'Unranked — incomplete spending data':`#${row.rank} of ${ranking.rankedCount} ${area.type==='ced'?'federal divisions':'LGAs'} by total spending`;
  const perPersonRanking=getRanking(area.type,'per-resident'),perPersonRow=perPersonRanking.rows.find(row=>row.area.id===area.id);
  $('per-person-label').textContent=summary.incomplete?'Known annual spend per person':'Estimated annual spend per person';
  $('per-person-value').textContent=formatAUD(summary.totalPerResident.value);
  $('per-person-value').dataset.unavailable=String(!Number.isFinite(summary.totalPerResident.value));
  $('per-person-context').textContent=`Per resident · FY${summary.financialYear.replace('-','–')}`;
  $('per-person-rank').textContent=perPersonRow.rank===null?(summary.incomplete?'Unranked — incomplete spending data':'Unranked — compatible population unavailable'):`#${perPersonRow.rank} of ${perPersonRanking.rankedCount} ${area.type==='ced'?'federal divisions':'LGAs'} by per-person spending`;
  if(rankingType!==area.type||!fromRanking)rankingPage=0;
  rankingType=area.type;renderRankings();
  $('payment-list').innerHTML=summary.groups.map(group=>`<li class="payment-row"><div class="payment-name">${escape(group.label)}<details><summary>About this payment</summary><p>${escape(group.id==='cra'?'An extra payment to help eligible renters who receive a qualifying payment. Government spending figures already include Rent Assistance within the payments through which it is paid. Its separate estimate is shown for context; adding it to the subtotal would count some spending twice. Some Rent Assistance is paid through programmes outside this selection.':group.description)}</p>${group.components?.length>1?`<ul class="component-spending">${group.components.map(c=>`<li>${escape(c.label)}: ${escape(formatAUD(c.spending.value,{roundTo:1000}))} estimated annual spend</li>`).join('')}</ul>`:''}</details></div><div class="counts">${group.counts.map(c=>`<div>${!['People','Participants'].includes(c.label)?`<span class="count-label">${escape(c.label)}</span>`:''}<strong>${escape(formatCount(c))}</strong><span class="recipient-rate">${escape(formatRecipientRate(c.rate))}</span></div>`).join('')}${['youth','parenting'].includes(group.id)?`<span class="combined-rate">Combined: ${escape(formatRecipientRate(summary.recipientMeasures.find(metric=>metric.id===group.id).rate))}</span>`:''}</div><div class="payment-money">${escape(formatAUD(group.spending.value,{compact:true}))}${group.additive===false?'<small>Not added to subtotal</small>':''}</div></li>`).join('');
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
  $('document-text-content').innerHTML=`<h3>${escape(content.area)} — ${escape(content.title)}</h3><p>${escape(content.geography)}<br>${escape(content.period)}<br>${escape(content.countDate)}<br>${escape(content.populationDate)}</p><p><strong>${escape(content.unit)}</strong></p><ul class="document-text-rows">${content.rows.map(row=>`<li><strong>${escape(row.label)}: ${escape(row.money)}</strong><span>${row.countLines.map((line,i)=>`${escape(line)}<br>${escape(row.rateLines[i])}`).join('<br>')}${row.combinedRate?`<br><strong>${escape(row.combinedRate)}</strong>`:''}</span>${row.nonAdditive?'<small>Not added to subtotal</small>':''}</li>`).join('')}</ul><p><strong>${escape(content.totalLabel)}: ${escape(content.total)}</strong></p>${content.footer.map(note=>`<p>${escape(note)}</p>`).join('')}<p><a href="${escape(areaLink(summary,canonicalOrigin))}">View this area and its sources</a> · Release ${escape(summary.releaseId)}</p>`;
  try {
    const canvas=await previewGraphic(summary,style,canonicalOrigin);
    if(version!==previewVersion) return;
    const image=new Image();image.src=canvas.toDataURL('image/png');
    image.alt=`${selected.name} welfare ${style}. Full figures are available in “Read this ${style} as text” below.`;
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
function getRanking(type,metricId) {
  if(metricId==='spending')return rankings[type];
  const key=`${type}:${metricId}`;
  if(!additionalRankings.has(key))additionalRankings.set(key,buildRankings(release,type,metricId));
  return additionalRankings.get(key);
}
function renderRankings() {
  if(!rankings)return;
  const perPersonMode=rankingMetric==='per-resident';
  const rateMode=rankingMetric!=='spending'&&!perPersonMode;
  const ranking=getRanking(rankingType,rankingMetric);
  const percent=rateMode&&['people','participants'].includes(ranking.metric.unit);
  const query=$('ranking-search').value.trim();
  const ids=query?new Set(searchAreas(query,ranking.rows.map(row=>row.area)).map(area=>area.id)):null;
  const rows=ids?ranking.rows.filter(row=>ids.has(row.area.id)):ranking.rows;
  const pages=Math.max(1,Math.ceil(rows.length/rankingPageSize));
  rankingPage=Math.min(rankingPage,pages-1);
  const start=rankingPage*rankingPageSize;
  $('ranking-area-heading').textContent=rankingType==='ced'?'Federal division':'Council area (LGA)';
  $('ranking-year').textContent=rateMode?formatSourceDate(release.countDate):`FY${release.financialYear.replace('-','–')}`;
  $('ranking-intro').textContent=rateMode?`Highest to lowest ${ranking.metric.label} ${percent?'recipient percentage of all residents':`${ranking.metric.unit==='families'?'families':'income units'} per 1,000 residents`}. ${formatSourceDate(release.countDate)} recipients use ABS ${formatSourceDate(release.populationDate)} population. These are approximate rates, not eligibility rates.`:perPersonMode?`Highest to lowest estimated annual spending per person on the selected payments. Total annual spending is divided by ABS ${formatSourceDate(release.populationDate)} population, including all residents and children. Rent Assistance is not added twice.`:`Highest to lowest estimated total annual spending on the selected payments. Larger areas can spend more because they have more residents. Rent Assistance is not added twice. Population figures are ABS ${formatSourceDate(release.populationDate)} estimates.`;
  $('ranking-value-heading').textContent=rateMode?(percent?'% of residents':`${ranking.metric.unit==='families'?'Families':'Income units'} / 1,000`):perPersonMode?'Annual $ / person':'Annual spending';
  $('ranking-caption').textContent=rateMode?`National ${ranking.metric.label} recipient-rate rankings`:perPersonMode?'National rankings by estimated annual spending per person':'National rankings by total estimated annual spending for selected payments';
  $('ranking-count').textContent=`${ranking.rankedCount} of ${ranking.totalCount} ${rankingType==='ced'?'divisions':'LGAs'} ranked. ${ranking.totalCount-ranking.rankedCount?`${ranking.totalCount-ranking.rankedCount} have unavailable ${rateMode?'recipient rates':perPersonMode?'complete per-person estimates':'totals'} and are listed as unranked.`:'All have complete estimates.'}`;
  $('ranking-results').textContent=rows.length?`Showing ${start+1}–${Math.min(start+rankingPageSize,rows.length)} of ${rows.length} areas${query?' matching your search':''}. Ranks are national within the selected area type.`:'No matching areas. Try a name, state or four-digit postcode.';
  $('ranking-rows').innerHTML=rows.slice(start,start+rankingPageSize).map(row=>`<tr${row.area.id===selected?.id?' class="selected-ranking"':''}><td class="rank-number">${row.rank===null?'Unranked':`#${row.rank}`}</td><th scope="row"><a href="${escape(areaLink({area:row.area,releaseId:release.id},canonicalOrigin))}" data-ranking-area="${escape(row.area.id)}"${row.area.id===selected?.id?' aria-current="true"':''}>${escape(row.area.name)}<span>${escape(row.area.state)} · ${row.populationAvailable?`${row.area.population.value.toLocaleString('en-AU')} residents`:'Compatible population unavailable'}</span></a></th><td class="rank-spending"><strong>${escape(rateMode?formatRecipientRate(row.rate,{compact:true}):perPersonMode?formatAUD(row.perResident.value):formatAUD(row.total.value,{compact:true}))}</strong><small>${rateMode?escape(formatCount(row.count)):perPersonMode?row.eligible?`${escape(formatAUD(row.total.value,{compact:true}))} total`:row.populationAvailable?'Known subtotal · incomplete':'Population unavailable':row.eligible?escape(formatAUD(row.total.value,{roundTo:1000})):'Known subtotal · incomplete'}</small></td></tr>`).join('');
  $('ranking-footnote').textContent=rateMode?'Rates are shown only when the selected payment counts and a compatible positive population are available. Families and income units are not people percentages. Youth Allowance and Parenting Payment combine their separate individual categories; FTB Parts A and B stay separate. Payment shares can overlap and are not added together. Rankings use unrounded rates; exact ties share a rank.':perPersonMode?'Per-person values divide the annual programme total by all residents, including children. Incomplete totals or incompatible population estimates receive no rank. Displayed dollars are rounded; ranks use full precision and exact ties share a rank.':'Areas with missing or suppressed programme amounts retain their known subtotal, but receive no rank. Rankings use unrounded totals; displayed amounts are rounded. Exact ties share a rank. Select an area to see its counts and download its receipt or invoice.';
  $('ranking-prev').disabled=rankingPage===0;
  $('ranking-next').disabled=rankingPage>=pages-1;
  $('ranking-page').textContent=`Page ${rankingPage+1} of ${pages}`;
  for(const button of document.querySelectorAll('[data-ranking-type]'))button.setAttribute('aria-pressed',String(button.dataset.rankingType===rankingType));
}
window.addEventListener('pagehide',clearDownload);
$('search-form').addEventListener('submit',event=>{event.preventDefault();search();});
$('search-form').addEventListener('focusout',event=>{if(!$('search-form').contains(event.relatedTarget))closeSuggestions();});
$('area-search').addEventListener('input',event=>{if(event.isComposing)return;if(release&&$('area-search').value.trim().length>=2)search();else closeSuggestions();});
$('area-search').addEventListener('focus',()=>{if(release&&$('area-search').value.trim().length>=2)search();});
$('area-search').addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();if($('results').hidden)search();
    highlightSuggestion(event.key==='ArrowDown'?activeSuggestion+1:activeSuggestion<0?Math.min(matches.length,40)-1:activeSuggestion-1);
  }else if(event.key==='Enter'&&!$('results').hidden&&activeSuggestion>=0){event.preventDefault();chooseSuggestion(activeSuggestion);}
  else if(event.key==='Escape'){event.preventDefault();closeSuggestions();}
  else if(event.key==='Tab')closeSuggestions();
});
for(const button of document.querySelectorAll('[data-query]'))button.addEventListener('click',()=>{$('area-search').value=button.dataset.query;$('area-search').focus();search();});
$('area-results').addEventListener('pointerdown',event=>event.preventDefault());
$('area-results').addEventListener('click',event=>{const option=event.target.closest('[data-search-index]');if(option)chooseSuggestion(Number(option.dataset.searchIndex));});
document.addEventListener('pointerdown',event=>{if(!$('search-form').contains(event.target))closeSuggestions();});
window.addEventListener('resize',()=>positionSuggestions(true));
window.addEventListener('scroll',()=>positionSuggestions(),{passive:true});
window.visualViewport?.addEventListener('resize',()=>positionSuggestions(true));
window.visualViewport?.addEventListener('scroll',()=>positionSuggestions(),{passive:true});
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
$('ranking-metric').addEventListener('change',()=>{rankingMetric=$('ranking-metric').value;rankingPage=0;renderRankings();});
for(const link of document.querySelectorAll('[data-ranking-metric]'))link.addEventListener('click',()=>{rankingMetric=link.dataset.rankingMetric;$('ranking-metric').value=rankingMetric;if(selected&&link.closest('#area-summary')){rankingType=selected.type;$('ranking-search').value='';}rankingPage=0;renderRankings();});
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
