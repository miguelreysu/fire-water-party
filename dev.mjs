import {createServer} from 'node:http';
import {createServer as viteServer} from 'vite';
import handler from './api/index.js';
const port=Number(process.argv[process.argv.indexOf('--port')+1])||5173;
const vite=await viteServer({server:{middlewareMode:true},appType:'spa'});
createServer(async(req,res)=>{if(req.url.startsWith('/api/')){let bytes=0,chunks=[];for await(const c of req){bytes+=c.length;if(bytes>900000){res.writeHead(413);res.end('Too large');return}chunks.push(c)}const u=new URL(req.url,'http://localhost');req.query={...Object.fromEntries(u.searchParams),action:u.pathname.split('/')[2]};try{req.body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};}catch{res.writeHead(400);res.end('Invalid JSON');return}res.status=(n)=>{res.statusCode=n;return res};res.json=(d)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d))};await handler(req,res);}else vite.middlewares(req,res);}).listen(port,'0.0.0.0',()=>console.log('Fire & Water preview ready on port '+port));
