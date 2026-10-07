export const welfareScopes=[
  {id:'all',label:'All selected welfare',description:'All programmes included in this data release. Programme groups describe the purpose of support, not recipients’ ages.'},
  {id:'working',label:'Working-age & family support',description:'JobSeeker, Youth Allowance, family support, disability support and Carer Payment. These programmes can also support older people; this is not a count of working-age recipients.'},
  {id:'retirement',label:'Retirement & aged care',description:'Age Pension and the aged-care services included in this release. Some aged-care users are younger people. These are programme groups, not recipient age bands.'}
];

export function scopeFor(id) {return welfareScopes.find(scope=>scope.id===id)??welfareScopes[0];}

export function filterRelease(release,id='all') {
  const scope=scopeFor(id);
  return {...release,scope,areas:release.areas.map(area=>{
    const groups=area.groups.filter(group=>{
    if(scope.id==='all'||group.id==='cra')return true;
    const retirement=group.id==='age'||group.id.startsWith('aged-care-');
    return scope.id==='retirement'?retirement:!retirement;
    });
    if(scope.id==='retirement')groups.sort((a,b)=>Number(a.id==='cra')-Number(b.id==='cra'));
    return {...area,groups:groups.map(group=>group.overlapWith?{...group,additive:!groups.some(other=>other.id===group.overlapWith),nonAdditiveNote:'Shown separately: can overlap NDIS'}:group)};
  })};
}
