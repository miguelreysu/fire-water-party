import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
export function safeEqual(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y)}
export function seal(data,secret){const payload=Buffer.from(JSON.stringify(data)).toString('base64url');return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url')}
export function unseal(token,secret,role){try{const [p,s,...extra]=String(token).split('.');if(extra.length||!safeEqual(s,createHmac('sha256',secret).update(p).digest('base64url')))return null;const d=JSON.parse(Buffer.from(p,'base64url'));return d.exp>Date.now()&&d.role===role?d:null}catch{return null}}
export function session(role,secret){return seal({role,id:randomBytes(16).toString('hex'),exp:Date.now()+(role==='admin'?8:48)*3600000},secret)}
export function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim().split('=')))}
export function cookie(name,value,secure,maxAge){return `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`}
export function sameOrigin(req,origin){return req.headers.origin===origin}
export function validPhotoId(id,event){return typeof id==='string'&&new RegExp('^'+event+'/[a-f0-9]{32}/[0-4]$').test(id)}
