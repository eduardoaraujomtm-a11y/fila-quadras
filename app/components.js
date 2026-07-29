'use client';
import { fmtClock, fmtTime, msLeft, groupLabel, groupTag } from './live';

export function CourtCard({ court, now, queueLen }) {
  if (court.status === 'lesson') {
    const until = court.lesson?.until;
    return (
      <div className="court lesson">
        <div className="cnum">{court.name}<span className="pill lesson">Aula</span></div>
        <div className="who">{court.lesson?.label || 'Aula'}</div>
        <div className="foot">
          <div className="sub">{until ? `Bloqueada até ${fmtTime(until)}` : 'Bloqueada'} · fora da fila</div>
        </div>
      </div>
    );
  }
  if (court.status === 'prep') {
    return (
      <div className="court prep">
        <div className="cnum">{court.name}<span className="pill prep">Em preparo</span></div>
        <div className="who">Preparando a quadra</div>
        <div className="foot">
          <div className="sub"><b>Próximos:</b> {groupLabel(court.called) || '—'}<br />cronômetro só inicia ao jogar</div>
        </div>
      </div>
    );
  }
  if (court.status === 'playing') {
    const left = msLeft(court, now);
    const total = (court.duo?.limit || 60) * 60 * 1000;
    const pct = Math.max(0, Math.min(100, ((total - left) / total) * 100));
    const near = left <= 5 * 60 * 1000;
    const barColor = near ? 'var(--live)' : pct > 66 ? 'var(--wait)' : 'var(--ball)';
    return (
      <div className="court">
        <div className="cnum">{court.name}{court.duo?.type === 'batedor' && <span className="pill prep">Batedor · 30 min</span>}{near && <span className="pill live">no limite</span>}</div>
        <div className="who">{groupLabel(court.duo)}</div>
        <div className="foot">
          <div className="timer"><span className="t tabnums">{fmtClock(left)}</span><span className="u">restantes</span></div>
          <div className="prog"><i style={{ width: `${pct}%`, background: barColor }} /></div>
        </div>
      </div>
    );
  }
  // free
  return (
    <div className="court free">
      <div className="cnum">{court.name}</div>
      <div className="who">● Livre</div>
      <div className="foot">
        <div className="sub">{queueLen > 0 ? 'Aguardando a recepção chamar o próximo' : 'Sem fila no momento'}</div>
      </div>
    </div>
  );
}

export function CourtsGrid({ data, now }) {
  return (
    <div className="courts">
      {data.courts.map((c) => (
        <CourtCard key={c.id} court={c} now={now} queueLen={data.queue.length} />
      ))}
    </div>
  );
}

export function QueueList({ data, myGroupId }) {
  if (data.queue.length === 0) return <div className="empty">Ninguém na fila agora.</div>;
  return (
    <div>
      {data.queue.map((g, i) => (
        <div key={g.id} className={`qrow${i === 0 ? ' next' : ''}${g.id === myGroupId ? ' me' : ''}`}>
          <span className="qn">{i + 1}</span>
          <span className="qnm">{groupLabel(g)}{g.id === myGroupId ? ' (você)' : ''}<span className="qtag">{groupTag(g)}</span></span>
          <span className="qw">chegou {fmtTime(g.formedAt)}</span>
        </div>
      ))}
    </div>
  );
}
