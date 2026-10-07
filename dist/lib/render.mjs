import { formatAUD, formatMoneyObservation, formatCount, formatSourceDate, formatRecipientRate } from './model.mjs';

export {areaLink} from './urls.mjs';
export function exportFilename(summary,style,format) {
  const name=summary.area.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return `welfare-${summary.area.type}-${name}-${summary.scope?.id&&summary.scope.id!=='all'?summary.scope.id+'-':''}${style}-${summary.releaseId}.${format}`;
}
export function documentContent(summary,style) {
  const receipt=style==='receipt';
  return {
    title:receipt?'Welfare receipt':'Welfare invoice',
    scopeLabel:summary.scope?.label??'All selected welfare',
    area:summary.area.name,
    geography:`${summary.area.type==='ced'?'Federal electorate':'Council area'} · ${summary.area.state}`,
    period:`Financial year ${summary.financialYear.replace('-','–')}`,
    countDate:`Recipient snapshot: ${formatSourceDate(summary.countDate)}`,
    populationDate:`${summary.perResidentAvailable?formatCount({...summary.area.population,unit:'residents'}):'Population unavailable'} · ${formatSourceDate(summary.populationDate)}`,
    unit:receipt?'Estimated annual spending per resident':'Estimated annual programme spending',
    rows:summary.groups.map(group=>({label:group.short??group.label,
      countLines:group.counts.map(count=>`${['People','Participants'].includes(count.label)?'':count.label+': '}${formatCount(count)}${group.countCoverage==='annual'?` · FY${group.financialYear.replace('-','–')}`:''}`),
      rateLines:group.counts.map(count=>formatRecipientRate(count.rate)),
      combinedRate:['youth','parenting'].includes(group.id)?`Combined: ${formatRecipientRate(summary.recipientMeasures.find(metric=>metric.id===group.id).rate)}`:null,
      money:formatMoneyObservation((receipt?group.perResident:group.spending),{roundTo:receipt?1:1000}),
      incompleteAmount:group.spending.value===null&&Number.isFinite(group.spending.knownSubtotal),nonAdditive:group.additive===false,nonAdditiveNote:group.nonAdditiveNote??'Cross-program estimate; not added to subtotal',unavailable:group.spending.value===null,issues:group.issues??[]})),
    total:formatAUD((receipt?summary.totalPerResident:summary.total).value,{roundTo:receipt?1:1000}),
    totalLabel:summary.totalLabel,
    footer:[
      summary.scope?.description??'Programme groups describe support, not recipient age bands.',
      'Local spending is estimated from national expenditure and recipient shares.',
      'Rent Assistance helps eligible renters receiving a qualifying payment. It is not added to the subtotal because government expenditure already includes it within primary payments; adding it again would double count spending.',
      'The Rent Assistance estimate also covers programmes outside this selection; it is not an exact breakdown of the rows above.',
      'Counts can overlap. FTB counts cover instalment families; NDIS council conversions are estimated where boundaries change.',
      'Recipient rates use the dated population. Families and income units are per 1,000 residents, not percentages of people.',
      ...(summary.groups.some(group=>group.countCoverage==='annual')?['Home support counts cover the financial year; other counts are a June snapshot. Residential care uses facility location; counts can overlap.']:[]),
      ...(summary.groups.some(group=>group.id.startsWith('aged-care-'))?['Aged-care estimates use mapped client shares; unknown addresses are absent from this allocation proxy. Administration and other care programmes are outside this selection.']:[]),
      ...(summary.groups.some(group=>group.overlapWith)?[summary.scope?.id==='all'?'Residential aged care is not added to this subtotal because NDIS can reimburse the same care. Its separate estimate is shown above.':'Retirement totals include aged-care services and Age Pension. NDIS is outside this view.']:[]),
      receipt?'AUD per resident, rounded to whole dollars.':'AUD, rounded to the nearest $1,000.',
      ...(summary.issues??[]),
      summary.groups.some(group=>group.id.startsWith('aged-care-'))?'Sources: DSS, NDIA, ABS, AIHW GEN, Department of Health and Aged Care and Productivity Commission. Scan for data, dates and methodology.':'Sources: DSS, NDIA, ABS and Productivity Commission. Scan for data, dates and full methodology.'
    ]
  };
}

export function renderGraphic(summary,style,qrImage) {
  const content=documentContent(summary,style);
  const receipt=style==='receipt';
  const width=receipt?760:1120;
  const scale=2;
  const canvas=document.createElement('canvas');
  const height=Math.max(4000,1600+summary.groups.length*420);
  canvas.width=width*scale;canvas.height=height*scale;
  const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);
  const margin=receipt?58:68;
  const right=width-margin;
  let y=receipt?60:68;
  const pageBreaks=[];
  const face=receipt?'"Courier New", monospace':'Arial, sans-serif';
  function text(text,x,baseline,{size=26,bold=false,align='left',colour='#202222'}={}) {
    ctx.font=`${bold?'bold ':''}${size}px ${face}`;ctx.fillStyle=colour;ctx.textAlign=align;ctx.fillText(text,x,baseline);
  }
  function wrap(text,x,baseline,maxWidth,{size=24,bold=false,lineHeight=size*1.35,colour='#343a40',align='left'}={}) {
    ctx.font=`${bold?'bold ':''}${size}px ${face}`;
    let line='';let cursor=baseline;
    for(const word of text.split(/\s+/)) {
      const next=line?`${line} ${word}`:word;
      if(ctx.measureText(next).width>maxWidth&&line) { textLine(line,cursor);line=word;cursor+=lineHeight; }
      else line=next;
    }
    textLine(line,cursor);
    function textLine(line,baseline){ctx.fillStyle=colour;ctx.textAlign=align;ctx.fillText(line,x,baseline);}
    return cursor+lineHeight;
  }
  function line(baseline,dashed=false) {
    ctx.beginPath();ctx.strokeStyle='#adb2b2';ctx.lineWidth=1.5;ctx.setLineDash(dashed?[7,5]:[]);ctx.moveTo(margin,baseline);ctx.lineTo(right,baseline);ctx.stroke();ctx.setLineDash([]);
  }
  if(receipt) {
    text('WELFARE DATA',width/2,y,{size:34,bold:true,align:'center'});y+=36;
    text('AUSTRALIA',width/2,y,{size:26,align:'center'});y+=58;
    text('WELFARE RECEIPT',width/2,y,{size:27,bold:true,align:'center'});y+=48;
    y=wrap(content.area,margin,y,width-margin*2,{size:36,bold:true});
    text(content.geography,margin,y,{size:23});y+=43;
  } else {
    text('Welfare Data Australia',margin,y,{size:29,bold:true});
    if(qrImage)ctx.drawImage(qrImage,right-130,y+45,130,130);
    text('INVOICE',right,y,{size:33,bold:true,align:'right'});y+=64;
    y=wrap(content.area,margin,y,width-margin*2-(qrImage?170:0),{size:45,bold:true});
    text(content.geography,margin,y,{size:24});y+=45;
  }
  text(content.scopeLabel,margin,y,{size:24,bold:true});y+=33;
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
      if(row.incompleteAmount)y=wrap(row.money,right,y,width-margin*2,{size:28,bold:true,align:'right'});
      else {text(row.money,right,y,{size:32,bold:true,align:'right'});y+=38;}
      for(let i=0;i<row.countLines.length;i++){
        y=wrap(row.countLines[i],margin,y,width-margin*2,{size:24});
        y=wrap(row.rateLines[i],margin,y,width-margin*2,{size:21,colour:'#515858'});
      }
      if(row.combinedRate)y=wrap(row.combinedRate,margin,y,width-margin*2,{size:21,bold:true});
      if(row.nonAdditive) y=wrap(row.nonAdditiveNote,margin,y,width-margin*2,{size:21});
      y+=13;line(y,true);y+=35;
    } else {
      const start=y;
      const endLabel=wrap(row.label,margin,y,345,{size:25,bold:true});
      let countEnd=y;
      for(let i=0;i<row.countLines.length;i++){
        countEnd=wrap(row.countLines[i],margin+385,countEnd,290,{size:22});
        countEnd=wrap(row.rateLines[i],margin+385,countEnd,290,{size:19,colour:'#515858'});
      }
      if(row.combinedRate)countEnd=wrap(row.combinedRate,margin+385,countEnd,290,{size:19,bold:true});
      let moneyEnd=y;
      if(row.incompleteAmount)moneyEnd=wrap(row.money,right,y,235,{size:22,bold:true,align:'right'});
      else text(row.money,right,y,{size:26,bold:true,align:'right'});
      y=Math.max(endLabel,countEnd,moneyEnd)+16;
      if(row.nonAdditive) y=wrap(row.nonAdditiveNote,margin,y,right-margin,{size:20});
      y=Math.max(y,start+70);line(y);y+=38;
      pageBreaks.push(y-28);
    }
  }
  y+=8;
  text(content.totalLabel,margin,y,{size:receipt?24:27,bold:true});
  if(receipt) y+=48;
  text(content.total,right,y,{size:receipt?42:34,bold:true,align:'right'});y+=40;
  line(y,receipt);y+=38;
  for(const note of content.footer) {y=wrap(note,margin,y,width-margin*2,{size:receipt?21:22});y+=12;pageBreaks.push(y-28);}
  y+=18;
  if(qrImage&&receipt) {const qrSize=150;ctx.drawImage(qrImage,margin,y,qrSize,qrSize);text('View this area',margin+qrSize+25,y+45,{size:23,bold:true});text('and its sources',margin+qrSize+25,y+77,{size:21});y+=qrSize+26;}
  text(`Data release ${summary.releaseId}`,margin,y,{size:19});y+=38;
  const cropped=document.createElement('canvas');cropped.width=canvas.width;cropped.height=Math.ceil(y*scale);
  cropped.getContext('2d').drawImage(canvas,0,0);
  cropped.pageBreaks=pageBreaks.map(y=>Math.ceil(y*scale));
  canvas.width=1;canvas.height=1;
  return cropped;
}
