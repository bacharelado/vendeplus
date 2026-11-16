import {useState} from 'react';
export function VideoEmbed({videoId,title}:{videoId:string;title:string}){
 const [playing,setPlaying]=useState(false);
 if(!/^[A-Za-z0-9_-]{11}$/.test(videoId))return null;
 return <section className="listing-video-player" aria-label={'Vídeo de '+title}>
  <h2>Veja o produto em vídeo</h2>
  <div className="listing-video-frame">
   {playing?<iframe title={'Vídeo: '+title} src={'https://www.youtube-nocookie.com/embed/'+videoId+'?autoplay=1&rel=0'} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:
   <button type="button" className="listing-video-cover" onClick={()=>setPlaying(true)} aria-label={'Reproduzir vídeo de '+title}><span className="listing-video-play" aria-hidden="true">▶</span><strong>Assistir ao vídeo do anúncio</strong><small>O YouTube será carregado somente após seu toque.</small></button>}
  </div>
 </section>;
}
