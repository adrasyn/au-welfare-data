import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
await writeFile('.cache/vendor-entry.mjs',"export {jsPDF} from 'jspdf'; export {default as QRCode} from 'qrcode';\n");
await build({entryPoints:['.cache/vendor-entry.mjs'],outfile:'dist/vendor/export.js',bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'linked'});
console.log('Bundled local PDF and QR libraries');
