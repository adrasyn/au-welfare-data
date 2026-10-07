import {formatAUD} from '../dist/lib/model.mjs';
import {areaLink} from '../dist/lib/urls.mjs';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function socialPreview(summary,origin) {
  if(!summary)return {url:new URL('/',origin).href,image:new URL('/social/home.png',origin).href,title:'Welfare Data Australia — Your area’s welfare bill',description:'Explore local welfare spending and recipient counts. Find your area and download a receipt or invoice.',area:'Your area’s welfare bill.',amount:null,metric:'Find your area. See the figures.',scope:'Search by postcode, division or LGA',period:'',geography:'Australia',alt:'Welfare Data Australia. Your area’s welfare bill. Search by postcode, division or LGA.'};
  const available=summary.perResidentAvailable&&Number.isFinite(summary.totalPerResident.value);
  const amount=available?formatAUD(summary.totalPerResident.value):'Unavailable';
  const metric=!available?'Per-person spending unavailable':summary.incomplete?'Known annual spending per person · incomplete':'Estimated annual spending per person';
  const scope=summary.scope?.label??'All selected welfare',period=`FY${summary.financialYear.replace('-','–')}`;
  const geography=`${summary.area.type==='ced'?'Federal division':'Council area'} · ${summary.area.state}`;
  const excluded=summary.groups.some(group=>group.id==='aged-care-residential'&&group.additive===false);
  const description=`${amount} — ${metric.toLowerCase()}. ${scope}, ${period}. Uses all residents, including children.${excluded?' Residential aged care excluded to avoid overlap with NDIS.':''}`;
  const url=areaLink(summary,origin);
  const title=`${summary.area.name} — ${amount}${!available?'':summary.incomplete?' known spend per person (incomplete)':' per person'} | Welfare Data Australia`;
  return {url,image:new URL('preview.png',url).href,title,description,area:summary.area.name,amount,metric,scope,period,geography,alt:`${summary.area.name}, ${geography}. ${description}`};
}

export function socialMeta(card) {
  return `<link rel="canonical" href="${escape(card.url)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Welfare Data Australia">
  <meta property="og:locale" content="en_AU">
  <meta property="og:title" content="${escape(card.title)}">
  <meta property="og:description" content="${escape(card.description)}">
  <meta property="og:url" content="${escape(card.url)}">
  <meta property="og:image" content="${escape(card.image)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escape(card.alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(card.title)}">
  <meta name="twitter:description" content="${escape(card.description)}">
  <meta name="twitter:image" content="${escape(card.image)}">
  <meta name="twitter:image:alt" content="${escape(card.alt)}">`;
}

export function previewPage(template,card) {
  return template.replace(/<title>[^<]*<\/title>/,()=>`<title>${escape(card.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/,()=>`<meta name="description" content="${escape(card.description)}">`)
    .replace(/<!-- social-preview:start -->[\s\S]*?<!-- social-preview:end -->/,()=>`<!-- social-preview:start -->\n  ${socialMeta(card)}\n  <!-- social-preview:end -->`);
}

function wrapName(name,size) {
  const max=Math.floor(1072/(size*.64));
  const lines=[];let line='';
  for(const word of name.split(' ')){if(line&&(line+' '+word).length>max){lines.push(line);line=word;}else line=line?line+' '+word:word;}
  if(line)lines.push(line);
  return lines;
}

export function socialSvg(card) {
  const size=card.area.length>36?52:72;
  const lines=wrapName(card.area,size);
  const text=(value,x,y,fontSize,weight=400,fill='#252525')=>`<text x="${x}" y="${y}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}">${escape(value)}</text>`;
  const teeth=Array.from({length:61},(_,i)=>`${1200-i*20},${i%2?618:630}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#eeeeec"/>
  <path d="M0 0H1200V630L${teeth}Z" fill="#ffffff"/>
  <g font-family="Atkinson Hyperlegible">
  ${text('Welfare Data Australia',64,80,30,700)}
  ${text(card.geography,64,130,24,400,'#555555')}
  ${lines.map((line,i)=>text(line,64,228+i*(size*1.1),size,700)).join('')}
  ${card.amount?text(card.amount,64,420,card.amount==='Unavailable'?80:112,700,'#805600'):''}
  ${text(card.metric,64,card.amount?469:380,28)}
  ${text(card.scope+(card.period?' · '+card.period:''),64,card.amount?519:440,25,400,'#555555')}
  <path d="M64 558H1136" stroke="#ddddda"/>
  ${text('auwelfaredata.wlsn.me',64,598,24,700)}
  </g></svg>`;
}
