import {createServer} from "node:http";
import {Readable} from "node:stream";
import worker from "../dist/server/index.js";

const port=Number(process.argv[2] ?? 4173);
createServer(async (req,res) => {
  try {
    const headers=new Headers(req.headers);
    const origin="http://"+req.headers.host;
    const method=req.method;
    const body=method==="GET" || method==="HEAD" ? undefined : Readable.toWeb(req);
    const response=await worker.fetch(new Request(new URL(req.url,origin),{method,headers,body,duplex:body?"half":undefined}));
    res.writeHead(response.status,Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
  } catch {
    res.writeHead(500).end("Local server error");
  }
}).listen(port,"127.0.0.1",()=>console.log("Local: http://127.0.0.1:"+port+"/"));
