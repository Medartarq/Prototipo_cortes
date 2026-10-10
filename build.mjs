import {mkdir,copyFile,cp} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url)),out=new URL('./dist/',import.meta.url);await mkdir(out,{recursive:true});
for(const name of ['index.html','styles.css','app.mjs','core.mjs','guide.mjs','quote.mjs','hardware.mjs','exports.mjs','optimizer.mjs','optimizer-search.mjs','optimizer-quality.mjs','optimizer-worker.mjs','_headers'])await copyFile(new URL(name,import.meta.url),new URL(name,out));
for(const name of ['assets','vendor'])await cp(new URL(name,import.meta.url),new URL(name,out),{recursive:true});
console.log('Sitio estático listo en '+fileURLToPath(out));
