export default function Home() {
  return (
    <div className="wrap">
      <span className="kicker"><span className="ball" /> Fila das Quadras</span>
      <h1>A fila do clube, sem o quadro de caneta.</h1>
      <p className="lede">Protótipo funcional. Abra cada tela (dá para abrir em abas ou celulares diferentes na mesma rede) — tudo atualiza ao vivo entre elas.</p>

      <div className="hub">
        <a href="/checkin">
          <span className="em">🎾</span>
          <div>
            <h3>App do atleta</h3>
            <p>Fazer check-in (simula o QR), escolher o parceiro e entrar na fila.</p>
          </div>
        </a>
        <a href="/painel">
          <span className="em">📺</span>
          <div>
            <h3>Painel da parede</h3>
            <p>Quadras ao vivo e fila em ordem de chegada. Deixe aberto numa TV/tablet.</p>
          </div>
        </a>
        <a href="/publico">
          <span className="em">📱</span>
          <div>
            <h3>Consulta pública</h3>
            <p>Ver de casa se está cheio, espera estimada e horários de pico.</p>
          </div>
        </a>
        <a href="/recepcao">
          <span className="em">🛠️</span>
          <div>
            <h3>Recepção (admin)</h3>
            <p>Chamar a próxima, iniciar/encerrar jogo, bloquear aulas e controlar a fila.</p>
          </div>
        </a>
        <a href="/qr">
          <span className="em">⬛</span>
          <div>
            <h3>QR de check-in</h3>
            <p>Gerar e imprimir o QR para colar na recepção e nas quadras.</p>
          </div>
        </a>
      </div>
    </div>
  );
}
