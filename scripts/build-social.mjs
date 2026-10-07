import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {buildSummary} from '../dist/lib/model.mjs';
import {filterRelease,welfareScopes} from '../dist/lib/scopes.mjs';
import {socialPreview,socialSvg,previewPage} from './social-card.mjs';

const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
const template=await readFile(new URL('index.html',dist),'utf8');
const app=await readFile(new URL('app.mjs',dist),'utf8');
const origin=app.match(/const canonicalOrigin='([^']+)'/)?.[1];
if(!origin)throw new Error('The production origin is missing');
const fontFiles=['Regular','Bold'].map(weight=>fileURLToPath(new URL(`assets/social-fonts/AtkinsonHyperlegible-${weight}.ttf`,root)));
const render=card=>new Resvg(socialSvg(card),{font:{fontFiles,loadSystemFonts:false,defaultFontFamily:'Atkinson Hyperlegible'}}).render().asPng();
const home=socialPreview(null,origin);
await mkdir(new URL('social/',dist),{recursive:true});
await writeFile(new URL('social/home.png',dist),render(home));
await writeFile(new URL('index.html',dist),previewPage(template,home));
let count=0;
for(const filename of (await readdir(new URL('data/releases/',dist))).filter(name=>name.endsWith('.json')).sort()){
  const base=JSON.parse(await readFile(new URL('data/releases/'+filename,dist),'utf8'));
  for(const scope of welfareScopes){
    const release=filterRelease(base,scope.id);
    for(const area of release.areas){
      const card=socialPreview(buildSummary(area,release),origin);
      const folder=new URL('.'+new URL(card.url).pathname,dist);
      await mkdir(folder,{recursive:true});
      await writeFile(new URL('index.html',folder),previewPage(template,card));
      await writeFile(new URL('preview.png',folder),render(card));
      count++;
    }
  }
  console.log(`Social previews ready for ${base.id}`);
}
console.log(`Generated ${count} area previews and the homepage preview`);
