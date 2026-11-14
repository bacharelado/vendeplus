import {useState} from 'react';
import {Icon} from './Icon';

const video = 'https://drive.google.com/file/d/1lKwwG79DWtKwp-v8o_C__FPMj-849pxN/';
export function VideoFeature() {
  const [playing, setPlaying] = useState(false);
  return <section className="apocalyptic-feature" aria-labelledby="apocalyptic-feature-title">
    <div className="apocalyptic-feature-copy">
      <span className="market-section-kicker">APOCALYPTIC · ALERTA DE CIBERSEGURANÇA</span>
      <h2 id="apocalyptic-feature-title">Sua empresa está protegida — ou só contando com a sorte?</h2>
      <p>Invasões digitais, vazamentos de dados e operações interrompidas: este vídeo alerta sobre os riscos cibernéticos que empresas e serviços precisam levar a sério.</p>
      <a className="text-link" href={video+'view'} target="_blank" rel="noopener noreferrer">Assistir ao vídeo em outra janela <Icon name="arrow"/></a>
    </div>
    <div className="apocalyptic-player">
      {playing ? <iframe title="Vídeo de conscientização APOCALYPTIC sobre riscos cibernéticos" src={video+'preview'} allow="fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
        : <button type="button" className="video-cover" onClick={()=>setPlaying(true)} aria-label="Reproduzir vídeo da APOCALYPTIC">
          <span className="video-cover-brand">APOCALYPTIC</span>
          <span className="video-play" aria-hidden="true">▶</span>
          <strong>Segurança começa com atenção.</strong>
          <span>Reproduzir vídeo</span>
          <small>O player do Google Drive carrega ao tocar.</small>
        </button>}
    </div>
  </section>;
}
