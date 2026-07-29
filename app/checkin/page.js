'use client';
import { useEffect, useState } from 'react';
import { postJSON, fmtTime } from '../live';

const PID_KEY = 'fila_pid';

function initials(name) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '?') + (p[1]?.[0] || '')).toUpperCase();
}
const AV = ['var(--court)', '#7A5C9E', 'var(--ok)', '#B5842B', '#4A6DA7'];

export default function Checkin() {
  const [player, setPlayer] = useState(null);
  const [name, setName] = useState('');
  const [singles, setSingles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [state, setState] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // rehydrate saved player
  useEffect(() => {
    const pid = localStorage.getItem(PID_KEY);
    if (!pid) return;
    fetch(`/api/checkin?id=${pid}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.player) setPlayer(j.player);
        else localStorage.removeItem(PID_KEY);
      });
  }, []);

  // poll: my status, singles, snapshot
  useEffect(() => {
    if (!player) return;
    let alive = true;
    async function tick() {
      const [p, s, st] = await Promise.all([
        fetch(`/api/checkin?id=${player.id}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/singles?exclude=${player.id}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/state', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (!alive) return;
      if (p.player) setPlayer((cur) => ({ ...cur, duoId: p.player.duoId }));
      else { localStorage.removeItem(PID_KEY); setPlayer(null); }
      setSingles(s.singles || []);
      setState(st);
    }
    tick();
    const t = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [player?.id]);

  async function doCheckIn() {
    setErr(null); setBusy(true);
    const j = await postJSON('/api/checkin', { name });
    setBusy(false);
    if (!j.ok) return setErr(j.error);
    localStorage.setItem(PID_KEY, j.player.id);
    setPlayer(j.player);
  }

  async function form() {
    if (!selected) return;
    setErr(null); setBusy(true);
    const j = await postJSON('/api/duo', { playerId: player.id, partnerId: selected });
    setBusy(false);
    if (!j.ok) return setErr(j.error);
    setSelected(null);
  }

  async function disband() {
    if (!player?.duoId) return;
    setBusy(true);
    await postJSON('/api/duo', { duoId: player.duoId }, 'DELETE');
    setBusy(false);
    setPlayer((cur) => ({ ...cur, duoId: null }));
  }

  function leaveDevice() {
    localStorage.removeItem(PID_KEY);
    setPlayer(null); setName(''); setSingles([]); setSelected(null);
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="back" href="/">← início</a>
        <span className="kicker"><span className="ball" /> App do atleta</span>
      </div>

      {!player && (
        <div className="card">
          <h2>Check-in no clube</h2>
          <p className="lede">Na versão final, você chega ao clube e escaneia o QR fixo. Aqui, digite seu nome ou apelido para simular a leitura do QR.</p>
          {err && <div className="err">{err}</div>}
          <input className="field" placeholder="Seu nome ou apelido" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doCheckIn()} />
          <div style={{ height: 12 }} />
          <button className="btn primary block" disabled={busy || !name.trim()} onClick={doCheckIn}>
            Escanear QR e entrar
          </button>
        </div>
      )}

      {player && !player.duoId && (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="kicker" style={{ color: 'var(--ok)' }}>✓ presença confirmada</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>Oi, {player.name} 👋</div>
              </div>
              <button className="btn small" onClick={leaveDevice}>sair</button>
            </div>
          </div>

          <div className="card">
            <h2>Escolher parceiro</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: -6, marginBottom: 12 }}>
              Só aparece quem já fez check-in. Ao escolher, a dupla entra na fila na hora.
            </p>
            {err && <div className="err">{err}</div>}
            {singles.length === 0 && <div className="empty">Ninguém mais fez check-in ainda. Assim que o parceiro chegar e escanear o QR, ele aparece aqui.</div>}
            {singles.map((s, i) => (
              <button key={s.id} className={`player${selected === s.id ? ' sel' : ''}`} onClick={() => setSelected(s.id)}>
                <span className="av" style={{ background: AV[i % AV.length] }}>{initials(s.name)}</span>
                <div style={{ flex: 1 }}>
                  <div className="pnm">{s.name}</div>
                  <div className="pstat ok">✓ presente</div>
                </div>
                <span className="pick-r">{selected === s.id ? '✓' : ''}</span>
              </button>
            ))}
            {singles.length > 0 && (
              <>
                <div style={{ height: 8 }} />
                <button className="btn primary block" disabled={busy || !selected} onClick={form}>
                  {selected ? `Formar dupla com ${singles.find((x) => x.id === selected)?.name} · entrar na fila` : 'Escolha um parceiro'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {player && player.duoId && state && (
        <MyStatus state={state} myDuoId={player.duoId} onDisband={disband} busy={busy} playerName={player.name} onLeave={leaveDevice} />
      )}
    </div>
  );
}

function MyStatus({ state, myDuoId, onDisband, busy, playerName, onLeave }) {
  const pos = state.queue.findIndex((d) => d.id === myDuoId);
  const onCourt = state.courts.find((c) => c.duo?.id === myDuoId);
  const inPrep = state.courts.find((c) => c.called?.id === myDuoId);

  let banner;
  if (onCourt) banner = <div className="card" style={{ borderColor: 'var(--ok)', background: 'rgba(46,125,87,.07)' }}>
    <h2 style={{ margin: 0 }}>É a sua vez! 🎾</h2>
    <p className="lede" style={{ margin: '6px 0 0' }}>Vá para a <b>{onCourt.name}</b> — jogo em andamento.</p>
  </div>;
  else if (inPrep) banner = <div className="card" style={{ borderColor: 'var(--prep)', background: 'rgba(58,146,166,.08)' }}>
    <h2 style={{ margin: 0 }}>Sua dupla foi chamada!</h2>
    <p className="lede" style={{ margin: '6px 0 0' }}>Dirija-se à <b>{inPrep.name}</b>. A quadra está em preparo; a recepção libera o início.</p>
  </div>;
  else banner = <div className="card" style={{ borderColor: 'var(--saibro)', background: 'rgba(176,74,50,.06)' }}>
    <div className="kicker">sua posição na fila</div>
    <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--saibro)', lineHeight: 1, marginTop: 6 }}>
      {pos >= 0 ? `${pos + 1}º` : '—'}
    </div>
    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
      {pos === 0 ? 'Você é o próximo a ser chamado.' : pos > 0 ? `${pos} dupla(s) na sua frente.` : 'Aguardando…'}
    </div>
  </div>;

  return (
    <>
      <div className="topbar" style={{ marginBottom: 4 }}>
        <span className="muted" style={{ fontSize: 13 }}>{playerName}</span>
        <button className="btn small" onClick={onLeave}>sair</button>
      </div>
      {banner}
      <div className="card">
        <h2><span className="dot-live" />Fila ao vivo</h2>
        {state.queue.length === 0 && <div className="empty">Ninguém na fila.</div>}
        {state.queue.map((d, i) => (
          <div key={d.id} className={`qrow${i === 0 ? ' next' : ''}${d.id === myDuoId ? ' me' : ''}`}>
            <span className="qn">{i + 1}</span>
            <span className="qnm">{d.names.join(' × ')}{d.id === myDuoId ? ' (você)' : ''}</span>
            <span className="qw">chegou {fmtTime(d.formedAt)}</span>
          </div>
        ))}
      </div>
      {!onCourt && (
        <button className="btn danger block" disabled={busy} onClick={onDisband}>Desfazer dupla / sair da fila</button>
      )}
    </>
  );
}
