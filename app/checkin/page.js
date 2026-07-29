'use client';
import { useEffect, useRef, useState } from 'react';
import { postJSON, fmtTime, groupLabel, groupTag } from '../live';

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
  const [mode, setMode] = useState(null);      // singles | doubles | batedor
  const [sel, setSel] = useState([]);          // ids de parceiros escolhidos
  const [state, setState] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c');
    if (c) { setToken(c); window.history.replaceState({}, '', '/checkin'); }
    const pid = localStorage.getItem(PID_KEY);
    if (!pid) return;
    fetch(`/api/checkin?id=${pid}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (j.player) setPlayer(j.player); else localStorage.removeItem(PID_KEY);
    });
  }, []);

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
    if (!j.ok) { setErr(j.error); setToken(null); return; }
    localStorage.setItem(PID_KEY, j.player.id);
    setPlayer(j.player);
  }

  function toggle(pid) {
    setSel((cur) => {
      if (mode === 'singles') return cur.includes(pid) ? [] : [pid];
      if (cur.includes(pid)) return cur.filter((x) => x !== pid);
      if (cur.length >= 3) return cur; // duplas: máx 3 parceiros (total 4)
      return [...cur, pid];
    });
  }

  async function form() {
    setErr(null); setBusy(true);
    const j = await postJSON('/api/group', { creatorId: player.id, type: mode, partnerIds: mode === 'batedor' ? [] : sel });
    setBusy(false);
    if (!j.ok) return setErr(j.error);
    setMode(null); setSel([]);
  }

  async function disband(groupId) {
    setBusy(true);
    await postJSON('/api/group', { groupId }, 'DELETE');
    setBusy(false);
    setPlayer((cur) => ({ ...cur, duoId: null }));
  }

  function leaveDevice() {
    localStorage.removeItem(PID_KEY);
    setPlayer(null); setName(''); setSingles([]); setSel([]); setMode(null); setToken(null);
  }

  function onScanned(decoded) {
    setScanning(false); setErr(null);
    let t = decoded;
    try { const u = new URL(decoded); t = u.searchParams.get('c') || decoded; } catch {}
    setToken(t);
  }

  const inGroup = player && player.duoId;
  const bat = state?.batedor || { available: false, busy: false };

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="back" href="/">← início</a>
        <span className="kicker"><span className="ball" /> Atletas</span>
      </div>

      {inGroup && state && (
        <MyStatus player={player} state={state} singles={singles}
          onDisband={disband} busy={busy} onLeave={leaveDevice} setErr={setErr} err={err} />
      )}

      {player && !inGroup && (
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

          {!mode && (
            <div className="card">
              <h2>Como você vai jogar?</h2>
              {err && <div className="err">{err}</div>}
              <div className="modes">
                <button className="mode" onClick={() => { setErr(null); setSel([]); setMode('singles'); }}>
                  <span className="me">🎾</span>
                  <span className="mt"><b>Simples</b><span>Você e mais 1 (1 contra 1) · 60 min</span></span>
                </button>
                <button className="mode" onClick={() => { setErr(null); setSel([]); setMode('doubles'); }}>
                  <span className="me">👥</span>
                  <span className="mt"><b>Duplas</b><span>Até 4 jogadores · entra com 2, adiciona o resto depois</span></span>
                </button>
                <button className="mode" disabled={!bat.available || bat.busy}
                  onClick={() => { setErr(null); setSel([]); setMode('batedor'); }}>
                  <span className="me">🔴</span>
                  <span className="mt"><b>Bater bola com o Leandro</b>
                    <span>{bat.available ? (bat.busy ? 'Leandro está com outra pessoa agora' : 'Sozinho, 30 min') : 'Leandro indisponível agora'}</span></span>
                </button>
              </div>
            </div>
          )}

          {mode === 'batedor' && (
            <div className="card">
              <h2>Bater bola com o Leandro</h2>
              <p className="lede" style={{ fontSize: 15 }}>Sessão individual de <b>30 minutos</b> com o batedor. Você entra na fila e, quando pegar uma quadra, começa a contar.</p>
              {err && <div className="err">{err}</div>}
              <button className="btn primary block" disabled={busy} onClick={form}>Entrar na fila com o Leandro</button>
              <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setMode(null)}>Voltar</button>
            </div>
          )}

          {(mode === 'singles' || mode === 'doubles') && (
            <div className="card">
              <h2>{mode === 'singles' ? 'Escolher parceiro' : 'Escolher parceiros'}</h2>
              <p className="muted" style={{ fontSize: 13, marginTop: -6, marginBottom: 12 }}>
                {mode === 'singles'
                  ? 'Só aparece quem já escaneou o QR. Ao escolher, a dupla entra na fila.'
                  : 'Escolha ao menos 1 para entrar na fila (mínimo 2 no grupo). Os demais podem ser adicionados depois, quando chegarem.'}
              </p>
              {err && <div className="err">{err}</div>}
              {singles.length === 0 && <div className="empty">Ninguém mais fez check-in ainda. Assim que o parceiro escanear o QR, ele aparece aqui.</div>}
              {singles.map((s, i) => (
                <button key={s.id} className={`player${sel.includes(s.id) ? ' sel' : ''}`} onClick={() => toggle(s.id)}>
                  <span className="av" style={{ background: AV[i % AV.length] }}>{initials(s.name)}</span>
                  <div style={{ flex: 1 }}><div className="pnm">{s.name}</div><div className="pstat ok">✓ presente</div></div>
                  <span className="pick-r">{sel.includes(s.id) ? '✓' : ''}</span>
                </button>
              ))}
              <div style={{ height: 8 }} />
              <button className="btn primary block" disabled={busy || sel.length < 1} onClick={form}>
                {mode === 'singles' ? 'Formar dupla · entrar na fila' : `Entrar na fila (${sel.length + 1} jogador${sel.length ? 'es' : ''})`}
              </button>
              <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => { setMode(null); setSel([]); }}>Voltar</button>
            </div>
          )}
        </>
      )}

      {!player && scanning && <Scanner onDetected={onScanned} onCancel={() => setScanning(false)} />}

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

function MyStatus({ player, state, singles, onDisband, busy, onLeave, setErr, err }) {
  const [addSel, setAddSel] = useState([]);
  const [adding, setAdding] = useState(false);
  const gid = player.duoId;

  const inQueue = state.queue.find((g) => g.id === gid);
  const onCourt = state.courts.find((c) => c.duo?.id === gid);
  const inPrep = state.courts.find((c) => c.called?.id === gid);
  const group = onCourt?.duo || inPrep?.called || inQueue;
  const pos = state.queue.findIndex((g) => g.id === gid);

  async function addMembers() {
    setErr(null); setAdding(true);
    for (const pid of addSel) {
      await postJSON('/api/group', { op: 'add', groupId: gid, playerId: pid });
    }
    setAdding(false); setAddSel([]);
  }
  function toggleAdd(pid) {
    setAddSel((cur) => cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid]);
  }

  let banner;
  if (onCourt) banner = <div className="card" style={{ borderColor: 'var(--ok)', background: 'rgba(46,125,87,.07)' }}>
    <h2 style={{ margin: 0 }}>É a sua vez! 🎾</h2>
    <p className="lede" style={{ margin: '6px 0 0' }}>Vá para a <b>{onCourt.name}</b> — jogo em andamento.</p>
  </div>;
  else if (inPrep) banner = <div className="card" style={{ borderColor: 'var(--prep)', background: 'rgba(58,146,166,.08)' }}>
    <h2 style={{ margin: 0 }}>Seu grupo foi chamado!</h2>
    <p className="lede" style={{ margin: '6px 0 0' }}>Dirija-se à <b>{inPrep.name}</b>. A quadra está em preparo; a recepção libera o início.</p>
  </div>;
  else banner = <div className="card" style={{ borderColor: 'var(--saibro)', background: 'rgba(176,74,50,.06)' }}>
    <div className="kicker">sua posição na fila</div>
    <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--saibro)', lineHeight: 1, marginTop: 6 }}>{pos >= 0 ? `${pos + 1}º` : '—'}</div>
    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
      {pos === 0 ? 'Você é o próximo a ser chamado.' : pos > 0 ? `${pos} grupo(s) na sua frente.` : 'Aguardando…'}
    </div>
  </div>;

  const canAdd = group && group.type === 'doubles' && group.size < group.target && !onCourt;

  return (
    <>
      <div className="topbar" style={{ marginBottom: 4 }}>
        <span className="muted" style={{ fontSize: 13 }}>{player.name} · {group ? groupTag(group) : ''}</span>
        <button className="btn small" onClick={onLeave}>sair</button>
      </div>
      {banner}

      {group && (
        <div className="card">
          <h2>Seu grupo</h2>
          <div className="muted" style={{ fontSize: 14, marginBottom: canAdd ? 12 : 0 }}>{groupLabel(group)}</div>
          {canAdd && (
            <>
              <div className="lbl" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-2)', margin: '4px 0 8px' }}>
                Faltam {group.target - group.size} · adicionar quem já escaneou o QR
              </div>
              {err && <div className="err">{err}</div>}
              {singles.length === 0 && <div className="empty">Ninguém livre para adicionar. Quando o parceiro escanear o QR, ele aparece aqui.</div>}
              {singles.slice(0, 8).map((s, i) => (
                <button key={s.id} className={`player${addSel.includes(s.id) ? ' sel' : ''}`}
                  onClick={() => toggleAdd(s.id)} disabled={!addSel.includes(s.id) && addSel.length >= (group.target - group.size)}>
                  <span className="av" style={{ background: AV[i % AV.length] }}>{initials(s.name)}</span>
                  <div style={{ flex: 1 }}><div className="pnm">{s.name}</div><div className="pstat ok">✓ presente</div></div>
                  <span className="pick-r">{addSel.includes(s.id) ? '✓' : ''}</span>
                </button>
              ))}
              {singles.length > 0 && (
                <button className="btn primary block" style={{ marginTop: 8 }} disabled={adding || addSel.length === 0} onClick={addMembers}>
                  Adicionar {addSel.length || ''}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2><span className="dot-live" />Fila ao vivo</h2>
        {state.queue.length === 0 && <div className="empty">Ninguém na fila.</div>}
        {state.queue.map((g, i) => (
          <div key={g.id} className={`qrow${i === 0 ? ' next' : ''}${g.id === gid ? ' me' : ''}`}>
            <span className="qn">{i + 1}</span>
            <span className="qnm">{groupLabel(g)}{g.id === gid ? ' (você)' : ''}<span className="qtag">{groupTag(g)}</span></span>
            <span className="qw">chegou {fmtTime(g.formedAt)}</span>
          </div>
        ))}
      </div>

      {!onCourt && (
        <button className="btn danger block" disabled={busy} onClick={() => onDisband(gid)}>Desfazer grupo / sair da fila</button>
      )}
    </>
  );
}

function Scanner({ onDetected, onCancel }) {
  const [err, setErr] = useState(null);
  const stopRef = useRef(() => {});
  useEffect(() => {
    let qr; let stopped = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        qr = new Html5Qrcode('qr-reader');
        stopRef.current = () => { try { qr.stop().then(() => qr.clear()).catch(() => {}); } catch {} };
        await qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 }, (decoded) => {
          if (stopped) return; stopped = true; stopRef.current(); onDetected(decoded);
        }, () => {});
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
