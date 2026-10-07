const normalise=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();

export function searchAreas(query,areas) {
  const q=normalise(query);
  if(!q) return [];
  if(/^\d+$/.test(q)) return /^\d{4}$/.test(q)?areas.filter(a=>a.postcodes.includes(q)):[];
  const tokens=q.split(/\s+/);
  return areas.filter(area=> {
    const label=normalise(`${area.name} ${area.state} ${area.type==='ced'?'electorate constituency':'council local government area'}`);
    return tokens.every(token=>label.includes(token));
  }).sort((a,b)=>a.name.localeCompare(b.name,'en-AU') || a.type.localeCompare(b.type));
}

export function resolveAreaUrl(url,release) {
  const params=new URL(url).searchParams;
  if(params.get('release') && params.get('release')!==release.id) return null;
  return release.areas.find(a=>a.id===params.get('area'))??null;
}
