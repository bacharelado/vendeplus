import {useState} from 'react';
import {Icon} from './Icon';
import '../styles/vsl.css';

const videoUrl = 'https://drive.google.com/file/d/1lKwwG79DWtKwp-v8o_C__FPMj-849pxN/';
const message = 'Olá! Assisti à apresentação da APOCALYPTIC no VENDE+ e gostaria de solicitar um orçamento de avaliação de segurança digital para minha empresa.';
const whatsappUrl = 'https://wa.me/559281660856?text=' + encodeURIComponent(message);

export function VideoFeature(){
  const [playing,setPlaying] = useState(false);
  return <section id="apocalyptic-vsl" className="vsl-section" aria-labelledby="apocalyptic-vsl-title">
    <header className="vsl-heading">
      <span className="market-section-kicker">APOCALYPTIC · ALERTA DE CIBERSEGURANÇA</span>
      <h2 id="apocalyptic-vsl-title">Sua empresa está protegida — ou só contando com a sorte?</h2>
      <p>Conheça riscos digitais que podem interromper seu negócio e descubra por onde começar a protegê-lo.</p>
    </header>
    <div className="vsl-layout">
      <div className="vsl-content">
        <span className="vsl-eyebrow">SEGURANÇA DIGITAL PARA EMPRESAS</span>
        <h3>Você não precisa esperar um incidente para avaliar sua segurança.</h3>
        <p>Serviços expostos, configurações inseguras e vulnerabilidades esquecidas podem representar riscos reais. Identificar esses pontos é o primeiro passo para tomar decisões melhores.</p>
        <ul className="vsl-benefits">
          <li><Icon name="search"/><span>Identificação de possíveis vulnerabilidades</span></li>
          <li><Icon name="shield"/><span>Avaliação técnica de redes e sistemas</span></li>
          <li><Icon name="check"/><span>Relatório com recomendações objetivas</span></li>
        </ul>
        <p className="vsl-disclaimer">Avaliações realizadas com autorização do responsável e escopo previamente definido.</p>
      </div>
      <div className="vsl-media">
        <div className="vsl-player">
          {playing
            ? <iframe title="Apresentação da APOCALYPTIC sobre segurança digital" src={videoUrl + 'preview'} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
            : <button type="button" className="vsl-cover" onClick={()=>setPlaying(true)} aria-label="Reproduzir apresentação da APOCALYPTIC">
                <span className="vsl-cover-brand">APOCALYPTIC</span>
                <span className="vsl-cover-kicker">ASSISTA À APRESENTAÇÃO</span>
                <span className="vsl-play" aria-hidden="true">▶</span>
                <strong>Seu negócio merece atenção antes da próxima ameaça.</strong>
                <span className="vsl-play-label">Toque para assistir</span>
              </button>}
        </div>
        <div className="vsl-cta">
          <a className="vsl-cta-button" href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label="Solicitar orçamento de segurança digital da APOCALYPTIC pelo WhatsApp">
            <Icon name="whatsapp"/><span>Quero proteger meu negócio</span><Icon name="arrow"/>
          </a>
          <p>Atendimento direto no WhatsApp · Orçamento sob consulta</p>
        </div>
        <a className="vsl-open-video" href={videoUrl + 'view'} target="_blank" rel="noopener noreferrer">Abrir o vídeo em outra janela <Icon name="arrow"/></a>
      </div>
    </div>
  </section>;
}
