'use client';
import { useSnapshot, useNow, fmtTime, groupLabel, groupTag, computeEtas, fmtWait } from '../live';
import { CourtsGrid } from '../components';

function level(v) { return v < 45 ? 'var(--ok)' : v < 75 ? 'var(--ball)' : 'var(--wait)'; }

export default function Publico() {
  const { data } = useSnapshot(3000);
  const now = useNow(1000);
  const curHour = new Date(now).getHours();

  let livres = 0, aula = 0;
  if (data) {
    livres = data.courts.filter((c) => c.status === 'free').length;
    aula = data.courts.filter((c) => c.status === 'lesson').length;
  }
  const queueLen = data?.queue.length || 0;
  const etas = data ? computeEtas(data, now) : { byId: {}, nextFreeMin: null };
  const busyLevel = queueLen >= 3 ? 'alto' : queueLen >= 1 ? 'médio' : 'tranquilo';

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="back" href="/">← início</a>
        <span className="kicker"><span className="ball" /> Acompanhe as Quadras</span>
        <span className="muted" style={{ fontSize: 13 }}><span className="dot-live" />ao vivo</span>
      </div>

      {!data && <div className="card">Carregando…</div>}

      {data && (
        <>
          <div className="grid2" style={{ marginBottom: 16 }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="muted" style={{ fontSize: 13 }}>Quadras livres</div>
              <div style={{ fontSize: 30, fontWeight: 800 }} className="tabnums">{livres}<span style={{ fontSize: 15, color: 'var(--ink-2)' }}> / {data.courts.length}</span></div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="muted" style={{ fontSize: 13 }}>Se chegar agora, joga em</div>
              <div style={{ fontSize: 30, fontWeight: 800 }} className="tabnums">
                {livres > 0 ? 'agora' : fmtWait(etas.nextFreeMin)}
              </div>
            </div>
          </div>

          <div className="card" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: busyLevel === 'alto' ? 'rgba(201,138,23,.12)' : busyLevel === 'médio' ? 'rgba(199,214,74,.14)' : 'rgba(46,125,87,.08)',
            borderColor: busyLevel === 'alto' ? 'rgba(201,138,23,.3)' : 'var(--border)',
          }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: busyLevel === 'alto' ? 'var(--wait)' : busyLevel === 'médio' ? 'var(--ball-deep)' : 'var(--ok)' }} />
            <div style={{ fontSize: 14 }}>
              <b>Movimento {busyLevel} agora.</b>{' '}
              <span className="muted">{queueLen} dupla(s) na fila{aula > 0 ? ` · ${aula} quadra(s) em aula` : ''}.</span>
            </div>
          </div>

          <div className="card">
            <h2><span className="dot-live" />Quadras ao vivo</h2>
            <CourtsGrid data={data} now={now} />
          </div>

          <div className="card">
            <h2>Fila de espera</h2>
            {data.queue.length === 0 && <div className="empty">Ninguém na fila agora.</div>}
            {data.queue.map((g, i) => (
              <div key={g.id} className={`qrow${i === 0 ? ' next' : ''}`}>
                <span className="qn">{i + 1}</span>
                <span className="qnm">{groupLabel(g)}<span className="qtag">{groupTag(g)}</span></span>
                <span className="qw" style={{ textAlign: 'right', lineHeight: 1.35 }}>
                  <b style={{ color: 'var(--saibro)' }}>{fmtWait(etas.byId[g.id]?.waitMin)}</b>
                  {etas.byId[g.id]?.courtName ? ` · ${etas.byId[g.id].courtName}` : ''}
                </span>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Horários de pico</h2>
            <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
              Média por horário {data.peak.source === 'histórico' ? 'com base no histórico real de check-ins' : '(exemplo — ainda juntando histórico)'}.
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, marginTop: 8 }}>
              {data.peak.hours.map((p) => (
                <div key={p.h} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    height: `${Math.max(4, p.v)}%`, borderRadius: '5px 5px 3px 3px',
                    background: p.h === curHour ? 'var(--saibro)' : level(p.v),
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {data.peak.hours.map((p) => (
                <span key={p.h} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--ink-2)' }} className="tabnums">{p.h}h</span>
              ))}
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, background: 'rgba(199,214,74,.14)', borderLeft: '3px solid var(--ball-deep)', padding: '10px 12px', borderRadius: '0 8px 8px 0', marginTop: 12 }}>
              <b style={{ color: 'var(--ball-deep)' }}>Dica:</b> antes das 16h e depois das 21h costuma esvaziar.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
