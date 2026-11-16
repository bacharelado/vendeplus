// Retorna somente um ID confiável; não utiliza o link original no iframe.
export function videoIdFromUrl(value){
 if(typeof value!=='string')return null;
 const raw=value.trim();if(!raw||raw.length>300)return null;
 let url;try{url=new URL(raw)}catch{return null}
 if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
 const host=url.hostname.toLowerCase(),parts=url.pathname.split('/').filter(Boolean);
 let id=null;
 if(host==='youtu.be'&&parts.length===1)id=parts[0];
 else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host)){
  if(url.pathname==='/watch')id=url.searchParams.get('v');
  else if(parts.length===2&&['shorts','embed'].includes(parts[0]))id=parts[1];
 }
 return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
}
export function videoWatchUrl(id){return /^[A-Za-z0-9_-]{11}$/.test(String(id))?'https://www.youtube.com/watch?v='+id:null}
