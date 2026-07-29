'use client';
import { useSnapshot, useNow, fmtTime, groupLabel, groupTag, computeEtas, fmtWait } from '../live';
import { CourtsGrid } from '../components';

export default function Painel() {
  const { data } = useSnapshot(2000);
  const now = useNow(1000);
  const etas = data ? computeEtas(data, now) : { byId: {} };

  return (
    <div className="wrap wide">
      <div className="topbar">
        <a className="back" href="/">← início</a>
        <img className="brand-logo" src="/logo-lira.png" alt="Lira Tênis Clube · 100 anos" />
        <span className="muted tabnums" style={{ fontSize: 14 }}>
          <span className="dot-live" />ao vivo · {new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {!data && <div className="card">Carregando…</div>}

      {data && (
        <>
          <div className="card">
            <h2>Quadras</h2>
            <CourtsGrid data={data} now={now} />
          </div>

          <div className="card">
            <h2>Fila de espera · ordem de chegada</h2>
            {data.queue.length === 0 && <div className="empty">Ninguém na fila agora.</div>}
            {data.queue.map((g, i) => (
              <div key={g.id} className={`qrow${i === 0 ? ' next' : ''}`}>
                <span className="qn">{i + 1}</span>
                <span className="qnm">{groupLabel(g)}<span className="qtag">{groupTag(g)}</span></span>
                <span className="qw" style={{ textAlign: 'right', lineHeight: 1.35 }}>
                  <b style={{ color: 'var(--saibro)' }}>{fmtWait(etas.byId[g.id]?.waitMin)}</b>
                  {etas.byId[g.id]?.courtName ? ` · ${etas.byId[g.id].courtName}` : ''}
                  <br /><span style={{ color: 'var(--ink-2)' }}>chegou {fmtTime(g.formedAt)}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
