import {getCache} from '@vercel/functions';
import {v2 as cloudinary} from 'cloudinary';
import sharp from 'sharp';
import {defaults,validSettings,eventSettings} from '../src/shared.js';
import {safeEqual,session,unseal,cookies,cookie,sameOrigin,validPhotoId} from '../server/security.js';
export const config={api:{bodyParser:{sizeLimit:'900kb'}}};
const cache=new Map(), attempts=new Map();
const E=()=>process.env;
const event=()=>/^[a-z0-9-]{1,40}$/.test(E().EVENT_ID||'')?E().EVENT_ID:'fire-water';
function configure(){cloudinary.config({cloud_name:E().CLOUDINARY_CLOUD_NAME,api_key:E().CLOUDINARY_API_KEY,api_secret:E().CLOUDINARY_API_SECRET,secure:true});}
const configured=()=>['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','SESSION_SECRET','ADMIN_PASSWORD','APP_ORIGIN'].every(k=>E()[k])&&E().SESSION_SECRET.length>=32&&E().ADMIN_PASSWORD.length>=16;
function remoteCache(){return E().VERCEL==='1'?getCache({namespace:'fw:'+E().CLOUDINARY_CLOUD_NAME+':'+event()}):null}
async function invalidate(key){cache.delete(key);try{await remoteCache()?.delete(key)}catch{}}
async function memo(key,ttl,fn){
 let remote=remoteCache();if(remote){try{const value=await remote.get(key);if(value!==undefined&&value!==null)return value}catch{remote=null}}
 let x=cache.get(key);if(!remote&&x&&x.until>Date.now())return x.value;if(x?.promise)return x.promise;
 const promise=fn().then(async value=>{cache.set(key,{until:Date.now()+ttl,value});try{await remote?.set(key,value,{ttl:Math.ceil(ttl/1000),name:'fire-water-'+key})}catch{}return value}).catch(e=>{cache.delete(key);throw e});cache.set(key,{promise});return promise;
}
async function settings(){return memo('settings',5000,async()=>{const url=cloudinary.utils.private_download_url(`${event()}/settings.json`,'',{resource_type:'raw',type:'authenticated',expires_at:Math.floor(Date.now()/1000)+60});const r=await fetch(url);if(r.status===404)return {...defaults};if(!r.ok)throw Error('Settings unavailable');const s=await r.json();if(!validSettings(s))throw Error('Invalid settings');return eventSettings(s)})}
async function saveSettings(s){await cloudinary.uploader.upload('data:application/json;base64,'+Buffer.from(JSON.stringify(s)).toString('base64'),{resource_type:'raw',type:'authenticated',public_id:`${event()}/settings.json`,overwrite:true,invalidate:true});await invalidate('settings');}
function photo(r){return {id:r.public_id,created:r.created_at,bytes:r.bytes,approved:(r.tags||[]).includes('approved'),url:cloudinary.url(r.public_id,{type:'authenticated',resource_type:'image',format:'jpg',version:r.version,sign_url:true,secure:true}),thumb:cloudinary.url(r.public_id,{type:'authenticated',resource_type:'image',format:'jpg',version:r.version,transformation:[{width:480,crop:'limit',quality:65}],sign_url:true,secure:true})}}
async function allPhotos(){return memo('photos',25000,async()=>{let next_cursor,out=[];do{const page=await cloudinary.api.resources({resource_type:'image',type:'authenticated',prefix:event()+'/',max_results:500,tags:true,...(next_cursor?{next_cursor}:{})});out.push(...page.resources);next_cursor=page.next_cursor;if(out.length>3000)throw Error('Photo safety limit reached');}while(next_cursor);return out.filter(r=>validPhotoId(r.public_id,event())).map(photo)})}
function limited(key,max=8){const now=Date.now();if(attempts.size>10000)for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);let a=attempts.get(key);if(!a||a.until<now){a={n:0,until:now+60000};attempts.set(key,a)}return ++a.n>max;}
function error(status,message){return Object.assign(Error(message),{status})}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,data)=>res.status(status).json(data);
 try{
 const action=req.query?.action||new URL(req.url,'http://localhost').searchParams.get('action');
 if(action==='health')return send(200,{configured:!!configured(),mode:configured()?'live':'setup'});
 if(!configured()){if(action==='settings'&&req.method==='GET')return send(200,{...defaults,uploadsEnabled:false,setup:true});if(action==='photos'&&req.method==='GET'&&req.query?.admin!=='1')return send(200,{photos:[],setup:true});throw error(503,'Photo service is not configured yet. Please ask the host.');}
 configure();
 if(!['GET','POST'].includes(req.method))throw error(405,'Method not allowed');
 if(req.method==='POST'&&!sameOrigin(req,E().APP_ORIGIN))throw error(403,'Request origin rejected');
 const c=cookies(req), admin=unseal(c.fw_admin,E().SESSION_SECRET,'admin'),guest=unseal(c.fw_guest,E().SESSION_SECRET,'guest');
 let body=req.body||{};if(typeof body==='string'){try{body=JSON.parse(body)}catch{throw error(400,'Invalid JSON')}}
 const ip=req.headers['x-forwarded-for']?.split(',')[0]||'local';
 if(action==='guest'&&req.method==='POST'){
 const s=await settings();if(!s.uploadsEnabled)throw error(403,'Uploads are paused by the host');
 res.setHeader('Set-Cookie',cookie('fw_guest',guest?c.fw_guest:session('guest',E().SESSION_SECRET),E().APP_ORIGIN.startsWith('https:'),172800));return send(200,{ok:true});}
 if(action==='login'&&req.method==='POST'){
 if(limited('login:'+ip,20))throw error(429,'Too many attempts. Wait a minute.');
 const role='admin';if(body.role!=='admin'||!safeEqual(body.password,E().ADMIN_PASSWORD))throw error(401,'Incorrect code or password');
 res.setHeader('Set-Cookie',cookie('fw_'+role,role==='guest'&&guest?c.fw_guest:session(role,E().SESSION_SECRET),E().APP_ORIGIN.startsWith('https:'),role==='admin'?28800:172800));return send(200,{ok:true});}
 if(action==='logout'&&req.method==='POST'){res.setHeader('Set-Cookie',cookie('fw_admin','',E().APP_ORIGIN.startsWith('https:'),0));return send(200,{ok:true});}
 if(action==='settings'&&req.method==='GET'){const s=await settings();return send(200,s)}
 if(action==='photos'&&req.method==='GET'){
 const isAdmin=req.query?.admin==='1';if(isAdmin&&!admin)throw error(401,'Sign in as host');
 const list=(await allPhotos()).filter(p=>isAdmin||p.approved);
 if(!isAdmin)res.setHeader('Cache-Control','public, max-age=0, s-maxage=5, must-revalidate');
 return send(200,{photos:list});}
 if(action==='upload'&&req.method==='POST'){
 if(!guest)throw error(401,'Please retry your upload');
 const s=await settings();if(!s.uploadsEnabled)throw error(403,'Uploads are paused by the host');
 if(!Number.isInteger(body.slot)||body.slot<0||body.slot>4)throw error(400,'Five photos per browser are allowed');
 if(typeof body.image!=='string'||body.image.length>820000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.image))throw error(400,'Please upload a JPEG under 600 KB');
 const bytes=Buffer.from(body.image.split(',')[1],'base64');if(bytes.length>614400)throw error(413,'Image too large');
 const metadata=await sharp(bytes,{limitInputPixels:20000000}).metadata();if(metadata.format!=='jpeg')throw error(400,'Only valid JPEG photos are accepted');
 const image=await sharp(bytes,{limitInputPixels:20000000,animated:false,failOn:'error'}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:76,mozjpeg:true}).toBuffer();
 const id=`${event()}/${guest.id}/${body.slot}`;
 const result=await cloudinary.uploader.upload('data:image/jpeg;base64,'+image.toString('base64'),{public_id:id,resource_type:'image',type:'authenticated',overwrite:false,tags:[event(),s.autoApprove?'approved':'pending']});
 cache.delete('photos');return send(200,{id:result.public_id,approved:s.autoApprove});}
 if(!admin)throw error(401,'Sign in as host');
 if(action==='settings'&&req.method==='POST'){if(!validSettings(body))throw error(400,'Invalid event settings');await saveSettings(body);return send(200,{ok:true})}
 if(action==='moderate'&&req.method==='POST'){
 const ids=body.ids||[body.id];if(!Array.isArray(ids)||!ids.length||ids.length>50||!ids.every(id=>validPhotoId(id,event())))throw error(400,'Invalid photo IDs');
 if(body.operation==='approve'){await cloudinary.uploader.add_tag('approved',ids,{type:'authenticated'});await cloudinary.uploader.remove_tag('pending',ids,{type:'authenticated'});}
 else if(body.operation==='delete'&&ids.length===1)await cloudinary.uploader.destroy(body.id,{type:'authenticated',invalidate:true});
 else throw error(400,'Unknown action');await invalidate('photos');return send(200,{ok:true});}
 if(action==='usage'&&req.method==='GET'){return send(200,await memo('usage',300000,()=>cloudinary.api.usage()))}
 if(action==='export'&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="fire-water-photos.json"');return send(200,{exported:new Date().toISOString(),photos:await allPhotos()})}
 throw error(404,'Endpoint not found');
 }catch(e){const status=e.status||e.http_code||500;return send(status>=400&&status<600?status:500,{error:status===500?'Service temporarily unavailable. Please retry.':e.message||'Request failed'});}
}
