'use client';
import { fmtClock, fmtTime, msLeft } from './live';

export function CourtCard({ court, now, limitMinutes, queueLen }) {
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
    const nm = court.called?.names?.join(' × ') || '—';
    return (
      <div className="court prep">
        <div className="cnum">{court.name}<span className="pill prep">Em preparo</span></div>
        <div className="who">Preparando a quadra</div>
        <div className="foot">
          <div className="sub"><b>Próximos:</b> {nm}<br />cronômetro só inicia ao jogar</div>
        </div>
      </div>
    );
  }
  if (court.status === 'playing') {
    const left = msLeft(court, now, limitMinutes);
    const total = limitMinutes * 60 * 1000;
    const pct = Math.max(0, Math.min(100, ((total - left) / total) * 100));
    const near = left <= 5 * 60 * 1000;
    const barColor = near ? 'var(--live)' : pct > 66 ? 'var(--wait)' : 'var(--ball)';
    return (
      <div className="court">
        <div className="cnum">{court.name}{near && <span className="pill live">no limite</span>}</div>
        <div className="who">{court.duo?.names?.join(' × ')}</div>
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
        <div className="sub">{queueLen > 0 ? 'Aguardando a recepção chamar a próxima dupla' : 'Sem fila no momento'}</div>
      </div>
    </div>
  );
}

export function CourtsGrid({ data, now }) {
  return (
    <div className="courts">
      {data.courts.map((c) => (
        <CourtCard key={c.id} court={c} now={now} limitMinutes={data.limitMinutes} queueLen={data.queue.length} />
      ))}
    </div>
  );
}

export function QueueList({ data, myDuoId }) {
  if (data.queue.length === 0) return <div className="empty">Ninguém na fila agora.</div>;
  return (
    <div>
      {data.queue.map((d, i) => (
        <div key={d.id} className={`qrow${i === 0 ? ' next' : ''}${d.id === myDuoId ? ' me' : ''}`}>
          <span className="qn">{i + 1}</span>
          <span className="qnm">{d.names.join(' × ')}{d.id === myDuoId ? ' (você)' : ''}</span>
          <span className="qw">chegou {fmtTime(d.formedAt)}</span>
        </div>
      ))}
    </div>
  );
}
