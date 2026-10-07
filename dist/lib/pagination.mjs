export function invoiceSlices(height,maxHeight,breaks=[]) {
  if(!Number.isFinite(height)||height<=0||!Number.isFinite(maxHeight)||maxHeight<1)throw new Error('Invalid page dimensions');
  const boundaries=[...new Set(breaks.filter(y=>Number.isFinite(y)&&y>0&&y<height))].sort((a,b)=>a-b);
  const slices=[];
  let start=0;
  while(start<height) {
    const limit=Math.min(height,start+Math.floor(maxHeight));
    const end=limit===height?height:boundaries.filter(y=>y>start&&y<=limit).at(-1)??limit;
    slices.push({start,height:end-start});start=end;
  }
  return slices;
}
