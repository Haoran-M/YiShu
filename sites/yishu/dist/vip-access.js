import {publisherKey} from "./vip-public.js";

export const grant = "yishu-vip";
export const cookieName = "__Host-yishu_vip";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let key;
const isBase64Url = /^[A-Za-z0-9_-]+$/;

function decode(text) {
  return Uint8Array.from(atob(text.replaceAll("-","+").replaceAll("_","/")), character=>character.charCodeAt(0));
}

export async function verifyAccessCode(code, now = Date.now()) {
  if (typeof code !== "string" || code.length > 768) return null;
  const pieces = code.trim().split(".");
  if (pieces.length!==3 || pieces[0]!=="YS1" || !isBase64Url.test(pieces[1]) || !isBase64Url.test(pieces[2])) return null;
  try {
    const signature=decode(pieces[2]);
    if (signature.length!==64) return null;
    key ??= crypto.subtle.importKey("jwk",publisherKey,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
    const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},await key,signature,encoder.encode(pieces[0]+"."+pieces[1]));
    if (!valid) return null;
    const payload=JSON.parse(decoder.decode(decode(pieces[1])));
    const seconds=Math.floor(now/1000);
    return payload.aud===grant && Number.isSafeInteger(payload.iat) && Number.isSafeInteger(payload.exp) &&
      typeof payload.id==="string" && payload.iat<=seconds+120 && payload.exp>seconds && payload.exp>payload.iat ? payload : null;
  } catch { return null; }
}
