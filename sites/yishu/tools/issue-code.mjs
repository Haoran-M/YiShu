import {createPrivateKey,createPublicKey,generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";

const privatePath=join(process.env.LOCALAPPDATA ?? "", "YiShuPublisher","signing-key.pem");
if (!process.env.LOCALAPPDATA) throw new Error("Set LOCALAPPDATA to the publisher’s private local profile folder.");
const args=Object.fromEntries(process.argv.slice(2).map(value=>{
  const split=value.indexOf("=");
  return split===-1 ? [value,true] : [value.slice(0,split),value.slice(split+1)];
}));
if (!args["--init"] && !args["--out"]) throw new Error("Use --init or --out=<file> --days=<days>.");
let privateKey;
try { privateKey=createPrivateKey(await readFile(privatePath)); }
catch (error) {
  if (error.code!=="ENOENT" || !args["--init"]) throw error;
  await mkdir(dirname(privatePath),{recursive:true});
  privateKey=generateKeyPairSync("ec",{namedCurve:"prime256v1"}).privateKey;
  await writeFile(privatePath,privateKey.export({type:"pkcs8",format:"pem"}),{flag:"wx",mode:0o600});
}
if (args["--init"]) {
  const publicKey=createPublicKey(privateKey).export({format:"jwk"});
  await writeFile(new URL("../dist/vip-public.js",import.meta.url),"export const publisherKey = "+JSON.stringify(publicKey)+";\n");
}
if (args["--out"]) {
  const days=Number(args["--days"] ?? 30);
  if (!Number.isSafeInteger(days) || days<1 || days>3650) throw new Error("Choose a validity period from 1 to 3650 days.");
  const iat=Math.floor(Date.now()/1000);
  const body=Buffer.from(JSON.stringify({aud:"yishu-vip",iat,exp:iat+days*86400,id:randomBytes(12).toString("base64url")})).toString("base64url");
  const message="YS1."+body;
  const signature=sign("sha256",Buffer.from(message),{key:privateKey,dsaEncoding:"ieee-p1363"}).toString("base64url");
  const output=resolve(args["--out"]);
  const siteRoot=resolve(new URL("..",import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,"$1"));
  if (output.toLowerCase().startsWith(siteRoot.toLowerCase()+"\\")) throw new Error("Save codes outside the Site checkout.");
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,message+"."+signature+"\n",{flag:"wx",mode:0o600});
  console.log("Code saved to "+output);
}
