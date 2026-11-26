import {readFile,readdir,mkdir,writeFile} from "node:fs/promises";
import {join,relative,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const dist=join(root,"dist");
const contents=Object.create(null);
const mimes={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",".txt":"text/plain; charset=utf-8",".tsv":"text/tab-separated-values; charset=utf-8",
  ".png":"image/png",".jpg":"image/jpeg"};
async function collect(dir) {
  for (const file of await readdir(dir,{withFileTypes:true})) {
    if (dir===dist && ["server","analytics.html","analytics.js"].includes(file.name)) continue;
    const path=join(dir,file.name);
    if (file.isDirectory()) { await collect(path); continue; }
    const type=mimes[extname(file.name)];
    if (!type) throw new Error("Unknown asset type "+file.name);
    const pathname="/"+relative(dist,path).split(sep).join("/");
    const raw=await readFile(path);
    contents[pathname]=[type,raw.toString("base64")];
  }
}
await collect(dist);
const key=(await readFile(join(dist,"vip-public.js"),"utf8")).trim();
const verifier=(await readFile(join(dist,"vip-access.js"),"utf8")).replace(/^import .*?;\r?\n/,"").trim();
const worker=await readFile(join(root,"worker.js"),"utf8");
const build=key+"\n"+verifier+"\nconst assets="+JSON.stringify(contents)+";\n"+worker;
await mkdir(join(dist,"server"),{recursive:true});
await writeFile(join(dist,"server","index.js"),build);
console.log("Packaged "+Object.keys(contents).length+" assets in the Worker.");
