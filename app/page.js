export default function Home() {
  return (
    <div className="wrap">
      <img className="brand-logo" src="/logo-lira.png" alt="Lira Tênis Clube · 100 anos" />
      <span className="kicker big"><span className="ball" /> Quadro Virtual</span>
      <p className="lede" style={{ marginTop: 10 }}>Fila por ordem de chegada das quadras de tênis.</p>

      <div className="hub">
        <a href="/checkin">
          <span className="em">🎾</span>
          <div>
            <h3>Atletas</h3>
            <p>Fazer check-in (pelo QR no clube), escolher o parceiro e entrar na fila.</p>
          </div>
        </a>
        <a href="/publico">
          <span className="em">📱</span>
          <div>
            <h3>Acompanhe as Quadras</h3>
            <p>Ver de casa se está cheio, espera estimada e horários de pico.</p>
          </div>
        </a>
        <a href="/recepcao">
          <span className="em">🛠️</span>
          <div>
            <h3>Funcionários</h3>
            <p>Chamar a próxima, iniciar/encerrar jogo, bloquear aulas, controlar a fila e o QR. Requer senha.</p>
          </div>
        </a>
      </div>
    </div>
  );
}
