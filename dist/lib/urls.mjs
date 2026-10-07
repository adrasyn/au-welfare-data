export function areaLink(summary,origin) {
  const [type,code]=summary.area.id.split(':');
  const parts=[type,code,summary.releaseId,summary.scope?.id??'all'].map(encodeURIComponent);
  return new URL(`/area/${parts.join('/')}/`,origin).href;
}

export function readAreaLink(input) {
  const url=new URL(input);
  const match=url.pathname.match(/^\/area\/(ced|lga)\/([^/]+)\/([^/]+)\/(all|working|retirement)\/?$/);
  if(match) return {areaId:`${match[1]}:${decodeURIComponent(match[2])}`,releaseId:decodeURIComponent(match[3]),scope:match[4]};
  return {areaId:url.searchParams.get('area'),releaseId:url.searchParams.get('release'),scope:url.searchParams.get('scope')??'all'};
}
