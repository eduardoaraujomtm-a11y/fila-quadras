'use client';
import { useEffect, useRef, useState } from 'react';
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
  const [token, setToken] = useState(null);   // código do QR (candidato)
  const [scanning, setScanning] = useState(false);

  // rehydrate saved player + captura o código do QR (?c=)
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c');
    if (c) {
      setToken(c);
      // tira o código da barra de endereço (não deixa vazado no histórico)
      window.history.replaceState({}, '', '/checkin');
    }
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
    const j = await postJSON('/api/checkin', { name, token });
    setBusy(false);
    if (!j.ok) {
      setErr(j.error);
      // código inválido/expirado -> volta a pedir o QR
      setToken(null);
      return;
    }
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
    setPlayer(null); setName(''); setSingles([]); setSelected(null); setToken(null);
  }

  function onScanned(decoded) {
    setScanning(false);
    setErr(null);
    let t = decoded;
    try { const u = new URL(decoded); t = u.searchParams.get('c') || decoded; } catch { /* não é URL */ }
    setToken(t);
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="back" href="/">← início</a>
        <span className="kicker"><span className="ball" /> Atletas</span>
      </div>

      {/* 1) já checado: escolher parceiro / status */}
      {player && !player.duoId && (
        <PartnerPicker player={player} singles={singles} selected={selected} setSelected={setSelected}
          err={err} busy={busy} onForm={form} onLeave={leaveDevice} />
      )}
      {player && player.duoId && state && (
        <MyStatus state={state} myDuoId={player.duoId} onDisband={disband} busy={busy} playerName={player.name} onLeave={leaveDevice} />
      )}

      {/* 2) sem check-in, escaneando */}
      {!player && scanning && (
        <Scanner onDetected={onScanned} onCancel={() => setScanning(false)} />
      )}

      {/* 3) sem check-in, sem código: pedir o QR */}
      {!player && !scanning && !token && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>📷</div>
          <h2 style={{ marginTop: 6 }}>Escaneie o QR da parede</h2>
          <p className="lede" style={{ maxWidth: '34ch', margin: '0 auto 16px' }}>
            Para entrar na fila, escaneie o QR Code que está na parede do clube. É a forma de confirmar que você está presente.
          </p>
          <button className="btn primary block" onClick={() => { setErr(null); setScanning(true); }}>Abrir câmera para escanear</button>
          <p className="note" style={{ marginTop: 10 }}>Ou use a câmera normal do celular apontando para o QR.</p>
          {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
        </div>
      )}

      {/* 4) tem código, sem check-in: nome */}
      {!player && !scanning && token && (
        <div className="card">
          <div className="kicker" style={{ color: 'var(--ok)' }}>✓ QR lido — você está no clube</div>
          <h2 style={{ marginTop: 8 }}>Seu nome</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: -6, marginBottom: 12 }}>Como você quer aparecer na fila.</p>
          {err && <div className="err">{err}</div>}
          <input className="field" placeholder="Seu nome ou apelido" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doCheckIn()} autoFocus />
          <div style={{ height: 12 }} />
          <button className="btn primary block" disabled={busy || !name.trim()} onClick={doCheckIn}>Confirmar presença</button>
        </div>
      )}
    </div>
  );
}

function Scanner({ onDetected, onCancel }) {
  const [err, setErr] = useState(null);
  const stopRef = useRef(() => {});

  useEffect(() => {
    let qr;
    let stopped = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        qr = new Html5Qrcode('qr-reader');
        stopRef.current = () => { try { qr.stop().then(() => qr.clear()).catch(() => {}); } catch {} };
        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 230 },
          (decoded) => {
            if (stopped) return;
            stopped = true;
            stopRef.current();
            onDetected(decoded);
          },
          () => {}
        );
      } catch (e) {
        setErr('Não foi possível abrir a câmera. Permita o acesso à câmera ou aponte a câmera normal do celular para o QR.');
      }
    })();
    return () => { stopped = true; stopRef.current(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <h2>Escaneie o QR da parede</h2>
      {err && <div className="err">{err}</div>}
      <div id="qr-reader" style={{ width: '100%', borderRadius: 12, overflow: 'hidden', minHeight: 240, background: 'var(--paper)' }} />
      <div style={{ height: 12 }} />
      <button className="btn block" onClick={onCancel}>Cancelar</button>
    </div>
  );
}

function PartnerPicker({ player, singles, selected, setSelected, err, busy, onForm, onLeave }) {
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="kicker" style={{ color: 'var(--ok)' }}>✓ presença confirmada</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>Oi, {player.name} 👋</div>
          </div>
          <button className="btn small" onClick={onLeave}>sair</button>
        </div>
      </div>

      <div className="card">
        <h2>Escolher parceiro</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6, marginBottom: 12 }}>
          Só aparece quem já escaneou o QR. Ao escolher, a dupla entra na fila na hora.
        </p>
        {err && <div className="err">{err}</div>}
        {singles.length === 0 && <div className="empty">Ninguém mais fez check-in ainda. Assim que o parceiro escanear o QR, ele aparece aqui.</div>}
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
            <button className="btn primary block" disabled={busy || !selected} onClick={onForm}>
              {selected ? `Formar dupla com ${singles.find((x) => x.id === selected)?.name} · entrar na fila` : 'Escolha um parceiro'}
            </button>
          </>
        )}
      </div>
    </>
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
