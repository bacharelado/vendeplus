import {Component,type ReactNode} from 'react';

export class AppErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app dark recovery-screen"><section className="empty-state" role="alert">
      <a className="brand" href="/">VENDE<span>+</span></a>
      <h1>Vamos abrir o VENDE+ novamente.</h1>
      <p>Ocorreu uma falha ao exibir esta página. Recarregue para tentar novamente.</p>
      <button className="button primary" onClick={()=>location.reload()}>Recarregar página</button>
    </section></main>;
  }
}
