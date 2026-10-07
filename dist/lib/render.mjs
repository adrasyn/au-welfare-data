import { formatAUD, formatCount } from './model.mjs';

export function areaLink(summary,origin) {
  const url=new URL('/',origin);
  url.searchParams.set('area',summary.area.id);
  url.searchParams.set('release',summary.releaseId);
  return url.href;
}
export function exportFilename(summary,style,format) {
  const name=summary.area.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return `benefits-${summary.area.type}-${name}-${style}-${summary.releaseId}.${format}`;
}
export function documentContent(summary,style) {
  const receipt=style==='receipt';
  return {
    title:receipt?'Benefits receipt':'Benefits invoice',
    area:summary.area.name,
    geography:`${summary.area.type==='ced'?'Federal electorate':'Council area'} · ${summary.area.state}`,
    period:`Financial year ${summary.financialYear.replace('-','–')}`,
    countDate:'Recipient snapshot: June 2025',
    populationDate:'Resident population: June 2024',
    unit:receipt?'Estimated annual spending per resident':'Estimated annual programme spending',
    rows:summary.groups.map(group=>({label:group.short??group.label,
      countLines:group.counts.map(count=>`${['People','Participants'].includes(count.label)?'':count.label+': '}${formatCount(count)}`),
      money:formatAUD((receipt?group.perResident:group.spending).value,{roundTo:receipt?1:1000}),
      nonAdditive:group.additive===false,unavailable:group.spending.value===null})),
    total:formatAUD((receipt?summary.totalPerResident:summary.total).value,{roundTo:receipt?1:1000}),
    totalLabel:summary.totalLabel,
    footer:[
      'Local spending is estimated from national expenditure and recipient shares.',
      'Rent Assistance is shown for context and not added to the subtotal; it overlaps primary payment expenditure.',
      'Counts can overlap. FTB counts cover instalment families; NDIS council conversions are estimated where boundaries change.',
      receipt?'AUD per resident, rounded to whole dollars.':'AUD, rounded to the nearest $1,000.',
      'Sources: DSS, NDIA, ABS and Productivity Commission. Scan for data, dates and full methodology.'
    ]
  };
}

export function renderGraphic(summary,style,qrImage) {
  const content=documentContent(summary,style);
  const receipt=style==='receipt';
  const width=receipt?760:1120;
  const scale=2;
  const canvas=document.createElement('canvas');
  canvas.width=width*scale;canvas.height=4000*scale;
  const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,4000);
  const margin=receipt?58:68;
  const right=width-margin;
  let y=receipt?60:68;
  const face=receipt?'"Courier New", monospace':'Arial, sans-serif';
  function text(text,x,baseline,{size=26,bold=false,align='left',colour='#202222'}={}) {
    ctx.font=`${bold?'bold ':''}${size}px ${face}`;ctx.fillStyle=colour;ctx.textAlign=align;ctx.fillText(text,x,baseline);
  }
  function wrap(text,x,baseline,maxWidth,{size=24,bold=false,lineHeight=size*1.35,colour='#343a40'}={}) {
    ctx.font=`${bold?'bold ':''}${size}px ${face}`;
    let line='';let cursor=baseline;
    for(const word of text.split(/\s+/)) {
      const next=line?`${line} ${word}`:word;
      if(ctx.measureText(next).width>maxWidth&&line) { textLine(line,cursor);line=word;cursor+=lineHeight; }
      else line=next;
    }
    textLine(line,cursor);
    function textLine(line,baseline){ctx.fillStyle=colour;ctx.textAlign='left';ctx.fillText(line,x,baseline);}
    return cursor+lineHeight;
  }
  function line(baseline,dashed=false) {
    ctx.beginPath();ctx.strokeStyle='#adb2b2';ctx.lineWidth=1.5;ctx.setLineDash(dashed?[7,5]:[]);ctx.moveTo(margin,baseline);ctx.lineTo(right,baseline);ctx.stroke();ctx.setLineDash([]);
  }
  if(receipt) {
    text('BENEFITS DATA',width/2,y,{size:34,bold:true,align:'center'});y+=36;
    text('AUSTRALIA',width/2,y,{size:26,align:'center'});y+=58;
    text('BENEFITS RECEIPT',width/2,y,{size:27,bold:true,align:'center'});y+=48;
    y=wrap(content.area,margin,y,width-margin*2,{size:36,bold:true});
    text(content.geography,margin,y,{size:23});y+=43;
  } else {
    text('Benefits Data Australia',margin,y,{size:29,bold:true});
    text('INVOICE',right,y,{size:33,bold:true,align:'right'});y+=64;
    y=wrap(content.area,margin,y,width-margin*2,{size:45,bold:true});
    text(content.geography,margin,y,{size:24});y+=45;
  }
  text(content.period,margin,y,{size:24});y+=33;
  text(content.countDate,margin,y,{size:22});y+=33;
  text(content.populationDate,margin,y,{size:22});y+=37;
  y=wrap(content.unit,margin,y,width-margin*2,{size:24,bold:true});y+=15;
  line(y,receipt);y+=43;
  if(!receipt) {
    text('Programme',margin,y,{size:23,bold:true});
    text('Recipients',margin+385,y,{size:23,bold:true});
    text('Est. annual spend',right,y,{size:23,bold:true,align:'right'});y+=24;line(y);y+=38;
  }
  for(const row of content.rows) {
    if(receipt) {
      y=wrap(row.label,margin,y,width-margin*2,{size:28,bold:true});
      text(row.money,right,y,{size:32,bold:true,align:'right'});y+=38;
      for(const countLine of row.countLines) y=wrap(countLine,margin,y,width-margin*2,{size:24});
      if(row.nonAdditive) y=wrap('Cross-program estimate; not added to subtotal',margin,y,width-margin*2,{size:21});
      y+=13;line(y,true);y+=35;
    } else {
      const start=y;
      const endLabel=wrap(row.label,margin,y,345,{size:25,bold:true});
      let countEnd=y;
      for(const countLine of row.countLines) countEnd=wrap(countLine,margin+385,countEnd,290,{size:22});
      text(row.money,right,y,{size:26,bold:true,align:'right'});
      y=Math.max(endLabel,countEnd)+16;
      if(row.nonAdditive) y=wrap('Cross-program estimate; not added to subtotal',margin,y,right-margin,{size:20});
      y=Math.max(y,start+70);line(y);y+=38;
    }
  }
  y+=8;
  text(content.totalLabel,margin,y,{size:receipt?24:27,bold:true});
  if(receipt) y+=48;
  text(content.total,right,y,{size:receipt?42:34,bold:true,align:'right'});y+=40;
  line(y,receipt);y+=38;
  for(const note of content.footer) {y=wrap(note,margin,y,width-margin*2,{size:receipt?21:22});y+=12;}
  y+=18;
  if(qrImage) {const qrSize=receipt?150:130;ctx.drawImage(qrImage,margin,y,qrSize,qrSize);text('View this area',margin+qrSize+25,y+45,{size:23,bold:true});text('and its sources',margin+qrSize+25,y+77,{size:21});y+=qrSize+26;}
  text(`Data release ${summary.releaseId}`,margin,y,{size:19});y+=38;
  const cropped=document.createElement('canvas');cropped.width=canvas.width;cropped.height=Math.ceil(y*scale);
  cropped.getContext('2d').drawImage(canvas,0,0);
  canvas.width=1;canvas.height=1;
  return cropped;
}
