import {cp,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'publication/YiShu');
await mkdir(out,{recursive:true});
const excluded=new Set(['.git','.gradle','.kotlin','.idea','build','node_modules','local.properties']);
const filter=p=>!excluded.has(basename(p))&&!/\.(?:jks|keystore|p12|pem|dpapi|log)$/i.test(p);
for(const p of ['app','domain','gradle','desktop','docs','tools','sites','README.md','.gitignore','build.gradle.kts','settings.gradle.kts','gradle.properties','gradlew','gradlew.bat']){
  await cp(join(root,p),join(out,p),{recursive:true,filter});
}
// The repository contains source and reproducible build inputs. Binaries live in Releases.
await writeFile(join(out,'.gitignore'),(await readFile(join(root,'.gitignore'),'utf8'))+'\npublication/\ndist/\n!sites/yishu/dist/\n!sites/yishu/dist/**\n*.tar.gz\n');
console.log('Prepared public source at '+out);
