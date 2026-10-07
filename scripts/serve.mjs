import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.PORT??4173);
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',mjs:'text/javascript; charset=utf-8',js:'text/javascript; charset=utf-8',json:'application/json',svg:'image/svg+xml',png:'image/png',woff2:'font/woff2'};
http.createServer(async (req,res)=>{
  try {
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(path!==root && !path.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
    const filename=(await stat(path)).isDirectory()?resolve(path,'index.html'):path;
    res.writeHead(200,{'Content-Type':types[filename.split('.').pop()]??'application/octet-stream','Cache-Control':'no-cache'});
    res.end(await readFile(filename));
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
