import { jsPDF, QRCode } from '../vendor/export.js';
import { renderGraphic, areaLink } from './render.mjs';

async function qrImage(url) {
  const image=new Image();
  image.src=await QRCode.toDataURL(url,{width:420,margin:1,errorCorrectionLevel:'M'});
  await image.decode();
  return image;
}
export async function previewGraphic(summary,style,canonicalOrigin) {
  return renderGraphic(summary,style,await qrImage(areaLink(summary,canonicalOrigin)));
}
export async function exportGraphic(summary,style,format,canonicalOrigin) {
  if(style==='receipt'&&!summary.perResidentAvailable) throw new Error('No compatible resident population is available. Choose the invoice instead.');
  const canvas=await previewGraphic(summary,style,canonicalOrigin);
  if(format==='png') {
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The image could not be created. Try PDF instead.')),'image/png'));
  }
  if(format!=='pdf') throw new Error('Choose PNG or PDF.');
  const pageWidth=style==='receipt'?80:210;
  const naturalHeight=pageWidth*canvas.height/canvas.width;
  const pageHeight=style==='receipt'?naturalHeight:297;
  const doc=new jsPDF({unit:'mm',format:[pageWidth,pageHeight],orientation:'portrait',compress:true});
  const width=style==='receipt'?pageWidth:pageWidth-12;
  const height=width*canvas.height/canvas.width;
  const fit=Math.min(1,(pageHeight-12)/height);
  const finalWidth=width*fit;
  doc.addImage(canvas.toDataURL('image/png'),'PNG',(pageWidth-finalWidth)/2,style==='receipt'?0:6,finalWidth,height*fit,undefined,'FAST');
  doc.setProperties({title:`${summary.area.name} welfare ${style}`,subject:`Recipients and estimated programme spending, ${summary.financialYear}`,author:'Welfare Data Australia'});
  return doc.output('blob');
}
export function saveBlob(blob,filename,link) {
  const url=URL.createObjectURL(blob);
  const anchor=link??document.createElement('a');anchor.href=url;anchor.download=filename;
  if(!link) document.body.append(anchor);
  anchor.click();
  if(!link) {anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return url;
}
