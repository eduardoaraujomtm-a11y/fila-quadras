'use client';
import { useEffect, useState } from 'react';
import { useSnapshot, useNow, postJSON, fmtClock, fmtTime, msLeft, groupLabel, groupTag } from '../live';
import AdminGate from '../admin-gate';

const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export default function Recepcao() {
  return (
    <AdminGate>
      <RecepcaoInner />
    </AdminGate>
  );
}

function RecepcaoInner() {
  const { data, refresh } = useSnapshot(2000);
  const now = useNow(1000);
  const [err, setErr] = useState(null);

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    window.location.reload();
  }

  async function act(body) {
    setErr(null);
    const j = await postJSON('/api/court', body);
    if (!j.ok) setErr(j.error);
    refresh();
  }
  async function removeGroup(groupId) {
    setErr(null);
    const j = await postJSON('/api/group', { groupId }, 'DELETE');
    if (!j.ok) setErr(j.error);
    refresh();
  }
  async function toggleBatedor(available) {
    setErr(null);
    const j = await postJSON('/api/batedor', { available });
    if (!j.ok) setErr(j.error);
    refresh();
  }
  function block(courtId) {
    const label = window.prompt('Nome da aula / bloqueio:', 'Aula');
    if (label === null) return;
    const mins = parseInt(window.prompt('Bloquear por quantos minutos?', '60'), 10) || 60;
    act({ action: 'block', courtId, label, minutes: mins });
  }

  return (
    <div className="wrap wide">
      <div className="topbar">
        <a className="back" href="/">← início</a>
        <span className="kicker"><span className="ball" /> Funcionários</span>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn small" href="/qr">QR de check-in</a>
          <button className="btn small" onClick={() => { if (confirm('Zerar tudo (fila, quadras, presenças)?')) act({ action: 'reset' }); }}>Reset</button>
          <button className="btn small" onClick={logout}>Sair</button>
        </div>
      </div>

      {err && <div className="err">{err}</div>}
      {!data && <div className="card">Carregando…</div>}

      {data && (
        <>
          <div className="card">
            <h2>Quadras · controlar a troca</h2>
            <div className="courts">
              {data.courts.map((c) => (
                <AdminCourt key={c.id} court={c} now={now} limitMinutes={data.limitMinutes}
                  queueLen={data.queue.length} onAct={act} onBlock={block} refresh={refresh} onErr={setErr} />
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
              O preparo é tempo neutro: o cronômetro de {data.limitMinutes} min só começa ao tocar <b>“Iniciar jogo”</b>.
            </p>
          </div>

          <div className="card">
            <h2>Batedor · Leandro</h2>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 14 }}>
                {data.batedor?.available
                  ? <span style={{ color: 'var(--ok)', fontWeight: 700 }}>● Disponível{data.batedor?.busy ? ' · com uma pessoa agora' : ' · livre'}</span>
                  : <span className="muted">○ Indisponível — atletas não podem escolher o Leandro</span>}
              </div>
              {data.batedor?.available
                ? <button className="btn small danger" onClick={() => toggleBatedor(false)}>Encerrar disponibilidade</button>
                : <button className="btn small primary" onClick={() => toggleBatedor(true)}>Liberar o Leandro</button>}
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              Quando liberado, o atleta pode escolher bater bola com o Leandro (30 min). Ele atende uma pessoa por vez.
            </p>
          </div>

          <div className="card">
            <h2>Fila de espera · controlar</h2>
            {data.queue.length === 0 && <div className="empty">Ninguém na fila.</div>}
            {data.queue.map((g, i) => (
              <div key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div className={`qrow${i === 0 ? ' next' : ''}`} style={{ borderBottom: 'none' }}>
                  <span className="qn">{i + 1}</span>
                  <span className="qnm">{groupLabel(g)}<span className="qtag">{groupTag(g)}</span></span>
                  <span className="qw" style={{ marginRight: 8 }}>chegou {fmtTime(g.formedAt)}</span>
                  <button className="btn small danger" onClick={() => removeGroup(g.id)}>Remover</button>
                </div>
                {g.type === 'doubles' && g.size < g.target && (
                  <AddPlayer group={g} refresh={refresh} onErr={setErr} />
                )}
              </div>
            ))}
          </div>

          <ScheduleManager courts={data.courts} onErr={setErr} />
        </>
      )}
    </div>
  );
}

function AdminCourt({ court, now, limitMinutes, queueLen, onAct, onBlock, refresh, onErr }) {
  const cls = court.status === 'free' ? 'free' : court.status === 'prep' ? 'prep' : court.status === 'lesson' ? 'lesson' : '';
  const left = msLeft(court, now);
  return (
    <div className={`court ${cls}`}>
      <div className="cnum">
        {court.name}
        {court.status === 'prep' && <span className="pill prep">Em preparo</span>}
        {court.status === 'lesson' && <span className="pill lesson">Aula</span>}
        {court.status === 'playing' && court.duo?.type === 'batedor' && <span className="pill prep">30 min</span>}
        {court.status === 'playing' && left <= 5 * 60 * 1000 && <span className="pill live">no limite</span>}
      </div>

      {court.status === 'playing' && (
        <>
          <div className="who">{groupLabel(court.duo)}</div>
          <div className="foot">
            <div className="timer"><span className="t tabnums">{fmtClock(left)}</span><span className="u">restantes</span></div>
            <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn small" onClick={() => onAct({ action: 'extend', courtId: court.id, minutes: 15 })}>+15 min</button>
              <button className="btn small danger" onClick={() => onAct({ action: 'endGame', courtId: court.id })}>Encerrar jogo</button>
            </div>
            {court.duo?.type === 'doubles' && court.duo.size < court.duo.target && (
              <AddPlayer group={court.duo} refresh={refresh} onErr={onErr} />
            )}
          </div>
        </>
      )}

      {court.status === 'prep' && (
        <>
          <div className="who" style={{ fontSize: 14 }}>Próximos: {groupLabel(court.called) || '—'}</div>
          <div className="foot">
            <div className="sub">cronômetro inicia ao marcar “em jogo”</div>
            <div className="row" style={{ gap: 6, marginTop: 10 }}>
              <button className="btn small primary" onClick={() => onAct({ action: 'startGame', courtId: court.id })}>Iniciar jogo ▶</button>
            </div>
            {court.called?.type === 'doubles' && court.called.size < court.called.target && (
              <AddPlayer group={court.called} refresh={refresh} onErr={onErr} />
            )}
          </div>
        </>
      )}

      {court.status === 'free' && (
        <>
          <div className="who">● Livre</div>
          <div className="foot">
            <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn small primary" disabled={queueLen === 0} onClick={() => onAct({ action: 'callNext', courtId: court.id })}>
                Chamar próxima
              </button>
              <button className="btn small" onClick={() => onBlock(court.id)}>Bloquear (aula)</button>
            </div>
          </div>
        </>
      )}

      {court.status === 'lesson' && (
        <>
          <div className="who">{court.lesson?.label || 'Aula'}</div>
          <div className="foot">
            <div className="sub">
              até {fmtTime(court.lesson?.until)}{court.lesson?.recurring ? ' · grade fixa' : ''}
            </div>
            {!court.lesson?.recurring && (
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button className="btn small" onClick={() => onAct({ action: 'unblock', courtId: court.id })}>Liberar</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AddPlayer({ group, refresh, onErr }) {
  const [open, setOpen] = useState(false);
  const [singles, setSingles] = useState([]);
  const [busy, setBusy] = useState(false);
  const need = group.target - group.size;

  async function load() {
    const r = await fetch('/api/singles?exclude=none', { cache: 'no-store' });
    const j = await r.json();
    setSingles(j.singles || []);
  }
  function openIt() { onErr && onErr(null); setOpen(true); load(); }
  async function add(pid) {
    setBusy(true);
    const j = await postJSON('/api/group', { op: 'add', groupId: group.id, playerId: pid });
    setBusy(false);
    if (!j.ok) { onErr && onErr(j.error); return; }
    if (refresh) refresh();
    load();
  }

  if (!open) {
    return <button className="btn small" style={{ marginTop: 8 }} onClick={openIt}>+ Adicionar jogador ({need})</button>;
  }
  return (
    <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--paper)' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8, fontWeight: 600 }}>
        Faltam {need} · toque para adicionar quem já escaneou o QR
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {singles.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Ninguém livre no momento.</span>}
        {singles.map((s) => (
          <button key={s.id} className="btn small" disabled={busy} onClick={() => add(s.id)}>+ {s.name}</button>
        ))}
        <button className="btn small ghost" onClick={() => setOpen(false)}>fechar</button>
      </div>
    </div>
  );
}

function ScheduleManager({ courts, onErr }) {
  const [list, setList] = useState([]);
  const [courtId, setCourtId] = useState(courts[0]?.id || 'q1');
  const [weekday, setWeekday] = useState('2');
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('20:00');
  const [label, setLabel] = useState('Aula');

  async function load() {
    const r = await fetch('/api/schedule', { cache: 'no-store' });
    const j = await r.json();
    setList(j.schedule || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    onErr(null);
    const j = await postJSON('/api/schedule', {
      courtId, weekday: Number(weekday), startMin: toMin(start), endMin: toMin(end), label,
    });
    if (!j.ok) return onErr(j.error);
    load();
  }
  async function remove(id) {
    await postJSON('/api/schedule', { id }, 'DELETE');
    load();
  }
  const courtName = (id) => courts.find((c) => c.id === id)?.name || id;

  return (
    <div className="card">
      <h2>Grade fixa de aulas</h2>
      <p className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>
        Bloqueios que se repetem toda semana. A quadra sai da fila automaticamente no horário.
      </p>

      {list.length === 0 && <div className="empty">Nenhuma aula fixa cadastrada.</div>}
      {list.map((s) => (
        <div key={s.id} className="qrow">
          <span className="qnm">{courtName(s.courtId)} · <b>{WD[s.weekday]}</b> {toHHMM(s.startMin)}–{toHHMM(s.endMin)}</span>
          <span className="qw" style={{ marginRight: 8 }}>{s.label}</span>
          <button className="btn small danger" onClick={() => remove(s.id)}>Remover</button>
        </div>
      ))}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, alignItems: 'flex-end' }}>
        <select className="field" style={{ width: 'auto', flex: '1 1 130px' }} value={courtId} onChange={(e) => setCourtId(e.target.value)}>
          {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="field" style={{ width: 'auto', flex: '1 1 110px' }} value={weekday} onChange={(e) => setWeekday(e.target.value)}>
          {WD.map((w, i) => <option key={i} value={i}>{w}</option>)}
        </select>
        <input className="field" style={{ width: 'auto', flex: '0 1 90px' }} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <input className="field" style={{ width: 'auto', flex: '0 1 90px' }} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        <input className="field" style={{ width: 'auto', flex: '1 1 120px' }} placeholder="Rótulo (ex: Prof. Ana)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn primary" onClick={add}>Adicionar</button>
      </div>
    </div>
  );
}
